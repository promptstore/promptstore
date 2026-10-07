import { errorAssistant, runAgentLoop, runAgentLoopContinue } from './agentLoop';
import type {
  AgentEvent,
  AgentLoopConfig,
  HarnessMessage,
  HarnessTool,
  ImageContent,
  StreamFn,
  UserMessage,
} from './types';

export type QueueMode = 'all' | 'one-at-a-time';

export interface AgentState {
  systemPrompt?: string;
  tools: HarnessTool[];
  messages: HarnessMessage[];
  isStreaming: boolean;
  pendingToolCalls: Set<string>;
  errorMessage?: string;
}

export interface AgentOptions extends AgentLoopConfig {
  streamFn: StreamFn;
  systemPrompt?: string;
  tools?: HarnessTool[];
  messages?: HarnessMessage[];
  /** Default 'one-at-a-time'. */
  steeringMode?: QueueMode;
  /** Default 'one-at-a-time'. */
  followUpMode?: QueueMode;
  /** Parent signal; aborting it aborts the current run. */
  signal?: AbortSignal;
}

export type AgentListener = (event: AgentEvent, signal: AbortSignal) => void | Promise<void>;

/**
 * Stateful wrapper over the agent loop. Listeners are awaited in
 * subscription order, so they act as barriers between loop steps.
 */
export class Agent {

  readonly state: AgentState;

  private readonly options: AgentOptions;
  private listeners: AgentListener[] = [];
  private steeringQueue: HarnessMessage[] = [];
  private followUpQueue: HarnessMessage[] = [];
  private controller?: AbortController;
  private running?: Promise<void>;

  constructor(options: AgentOptions) {
    this.options = options;
    this.state = {
      systemPrompt: options.systemPrompt,
      tools: options.tools || [],
      messages: options.messages ? [...options.messages] : [],
      isStreaming: false,
      pendingToolCalls: new Set(),
    };
  }

  subscribe(listener: AgentListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  get signal(): AbortSignal | undefined {
    return this.controller?.signal;
  }

  /** Inject a message after the current turn's tool calls finish. */
  steer(message: HarnessMessage) {
    this.steeringQueue.push(message);
  }

  /** Inject a message only when the agent would otherwise stop. */
  followUp(message: HarnessMessage) {
    this.followUpQueue.push(message);
  }

  clearAllQueues() {
    this.steeringQueue = [];
    this.followUpQueue = [];
  }

  hasQueuedMessages() {
    return this.steeringQueue.length > 0 || this.followUpQueue.length > 0;
  }

  abort(reason?: any) {
    this.controller?.abort(reason);
  }

  async waitForIdle(): Promise<void> {
    await this.running;
  }

  reset() {
    this.state.messages = [];
    this.state.errorMessage = undefined;
    this.state.pendingToolCalls.clear();
    this.clearAllQueues();
  }

  async prompt(input: string | HarnessMessage | HarnessMessage[], images?: ImageContent[]): Promise<void> {
    let prompts: HarnessMessage[];
    if (typeof input === 'string') {
      const message: UserMessage = {
        role: 'user',
        content: images?.length ? [{ type: 'text', text: input }, ...images] : input,
        timestamp: Date.now(),
      };
      prompts = [message];
    } else {
      prompts = Array.isArray(input) ? input : [input];
    }
    return this.run((emit, signal) =>
      runAgentLoop(prompts, this.context(), this.loopConfig(), emit, signal, this.options.streamFn)
    );
  }

  /** Resume from the current transcript, draining queued messages if the last message is from the assistant. */
  async continue(): Promise<void> {
    const last = this.state.messages[this.state.messages.length - 1];
    if (last?.role === 'assistant') {
      const queued = this.dequeue('steering').concat(this.dequeue('followUp'));
      if (!queued.length) {
        throw new Error('Cannot continue: last message is an assistant message and no messages are queued');
      }
      return this.prompt(queued);
    }
    return this.run((emit, signal) =>
      runAgentLoopContinue(this.context(), this.loopConfig(), emit, signal, this.options.streamFn)
    );
  }

  private context() {
    return {
      systemPrompt: this.state.systemPrompt,
      tools: this.state.tools,
      messages: this.state.messages,
    };
  }

  private loopConfig(): AgentLoopConfig {
    const { streamFn, systemPrompt, tools, messages, steeringMode, followUpMode, signal, ...config } = this.options;
    return {
      ...config,
      getSteeringMessages: async () => {
        const fromHook = config.getSteeringMessages ? await config.getSteeringMessages() : [];
        return [...fromHook, ...this.dequeue('steering')];
      },
      getFollowUpMessages: async () => {
        const fromHook = config.getFollowUpMessages ? await config.getFollowUpMessages() : [];
        return [...fromHook, ...this.dequeue('followUp')];
      },
    };
  }

  private dequeue(which: 'steering' | 'followUp'): HarnessMessage[] {
    const mode = (which === 'steering' ? this.options.steeringMode : this.options.followUpMode) || 'one-at-a-time';
    const queue = which === 'steering' ? this.steeringQueue : this.followUpQueue;
    if (!queue.length) return [];
    return mode === 'all' ? queue.splice(0) : queue.splice(0, 1);
  }

  private async run(
    loop: (emit: (e: AgentEvent) => Promise<void>, signal: AbortSignal) => Promise<HarnessMessage[]>,
  ): Promise<void> {
    if (this.state.isStreaming) {
      throw new Error('Agent is already processing a prompt. Use steer() or followUp() to queue messages.');
    }
    const controller = new AbortController();
    this.controller = controller;
    const parent = this.options.signal;
    const onParentAbort = () => controller.abort(parent?.reason);
    if (parent) {
      if (parent.aborted) controller.abort(parent.reason);
      else parent.addEventListener('abort', onParentAbort, { once: true });
    }
    this.state.isStreaming = true;
    this.state.errorMessage = undefined;

    let sawEnd = false;
    const emit = async (event: AgentEvent) => {
      this.reduce(event);
      if (event.type === 'agent_end') sawEnd = true;
      for (const listener of this.listeners) {
        await listener(event, controller.signal);
      }
    };

    const task = (async () => {
      try {
        await loop(emit, controller.signal);
      } catch (err) {
        // surface loop failures as a synthetic error turn
        const message = errorAssistant(err instanceof Error ? err.message : String(err), controller.signal);
        await emit({ type: 'message_start', message });
        await emit({ type: 'message_end', message });
        await emit({ type: 'turn_end', turn: 0, message, toolResults: [] });
        if (!sawEnd) await emit({ type: 'agent_end', messages: [message] });
      } finally {
        this.state.isStreaming = false;
        this.state.pendingToolCalls.clear();
        parent?.removeEventListener('abort', onParentAbort);
      }
    })();
    this.running = task;
    await task;
  }

  private reduce(event: AgentEvent) {
    switch (event.type) {
      case 'message_end':
        this.state.messages.push(event.message);
        break;
      case 'context_replaced':
        this.state.messages = [...event.messages];
        break;
      case 'tool_execution_start':
        this.state.pendingToolCalls.add(event.toolCallId);
        break;
      case 'tool_execution_end':
        this.state.pendingToolCalls.delete(event.toolCallId);
        break;
      case 'turn_end':
        if (event.message.stopReason === 'error' || event.message.stopReason === 'aborted') {
          this.state.errorMessage = event.message.errorMessage;
        }
        break;
    }
  }
}
