import { Composition } from '../core/compositions/Composition';
import { MessageRole, convertContentTypeToString } from '../core/conversions/RosettaStone';
import type { HarnessServiceType } from '../core/harness/HarnessService';
import type { HarnessToolRef } from '../core/harness/types';
import { LLMModel } from '../core/models/llm_types';
import { SemanticFunction } from '../core/semanticfunctions/SemanticFunction';

interface AgentHarness {
  harnessService: HarnessServiceType;
  model: LLMModel;
  toolRefs: HarnessToolRef[];
}

export class AgentRuntime {

  agentType: string;
  agents: any;
  allowedTools: string[];
  compositions: Composition[];
  functions: SemanticFunction[];
  subAgents: any[];
  args: any;
  indexName: string;
  isChat: boolean;
  model: string;
  name: string;
  provider: string;
  selfEvaluate: boolean;
  useFunctions: boolean;
  harness?: AgentHarness;

  constructor({
    agentType,
    agents,
    allowedTools,
    compositions,
    functions,
    subAgents,
    args,
    indexName,
    isChat,
    model,
    name,
    provider,
    selfEvaluate,
    useFunctions,
    harness = undefined,
  }) {
    this.agentType = agentType;
    this.agents = agents;
    this.allowedTools = allowedTools;
    this.compositions = compositions;
    this.functions = functions;
    this.subAgents = subAgents;
    this.args = args;
    this.indexName = indexName;
    this.isChat = isChat;
    this.model = model;
    this.name = name;
    this.provider = provider;
    this.selfEvaluate = selfEvaluate;
    this.useFunctions = useFunctions;
    this.harness = harness;
  }

  async call({ email, callbacks, args, username, workspaceId, parentAgentName }) {
    if (this.agentType === 'harness') {
      return this.callHarness({ callbacks, args, username, workspaceId });
    }
    const modelParams = { max_tokens: 1024 };
    const options = {
      name: this.name,
      isChat: this.isChat,
      model: this.model,
      modelParams,
      provider: this.provider,
      workspaceId,
      username,
      useFunctions: this.useFunctions,
      semanticFunctions: this.functions,
      compositions: this.compositions,
      subAgents: this.subAgents,
    };
    let agent: any;
    if (this.agentType === 'plan') {
      agent = new this.agents.PlanAndExecuteAgent(options);
    } else if (this.agentType === 'openai') {
      agent = new this.agents.OpenAIAssistantAgent(options);
    } else if (this.agentType === 'react') {
      agent = new this.agents.MRKLAgent(options);
    } else if (this.agentType === 'simple') {
      agent = new this.agents.SimpleAgent(options);
    } else {
      const message = 'Unsupported agent type: ' + this.agentType;
      throw new Error(message);
    }
    const extraFunctionCallParams = {
      email: process.env.EMAIL_OVERRIDE || email,
      indexName: this.indexName,
    };
    const goal = [this.args?.goal, args?.goal].filter(g => g).join('\n\n');
    args = { ...(this.args || {}), ...(args || {}) };
    if (goal) {
      args.goal = goal;
    }
    const response = await agent.run({
      callbacks,
      args,
      allowedTools: this.allowedTools,
      extraFunctionCallParams,
      selfEvaluate: this.selfEvaluate,
      parentAgentName,
    });
    console.log('Return agent runtime response:', response);
    return response;
  }

  /**
   * Agent instructions (the agent's prompt) become the system prompt and the
   * goal the user message.
   */
  async callHarness({ callbacks = [], args, username, workspaceId }) {
    if (!this.harness) {
      throw new Error('Agent harness is not configured');
    }
    const { harnessService, model, toolRefs } = this.harness;
    const goal = args?.goal || this.args?.goal;
    for (const cb of callbacks) {
      cb.onAgentStart?.({ name: this.name, args: { goal }, model: this.model, modelParams: {} });
    }
    try {
      const { response } = await harnessService.run({
        name: this.name,
        model,
        provider: this.provider,
        modelKey: this.model,
        modelParams: { max_tokens: 4096 },
        systemPrompt: args?.goal ? this.args?.goal : undefined,
        prompts: [{ role: MessageRole.user, content: goal }],
        config: { enabled: true, tools: toolRefs },
        callbacks,
        run: { workspaceId, username },
      });
      const content = convertContentTypeToString(response.choices[0].message.content);
      for (const cb of callbacks) {
        cb.onAgentEnd?.({ response: content });
      }
      return content;
    } catch (err) {
      for (const cb of callbacks) {
        cb.onAgentEnd?.({ errors: [{ message: err.message }] });
      }
      throw err;
    }
  }

}