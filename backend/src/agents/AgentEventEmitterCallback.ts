import EventEmitter from 'events';

import { ModelOnStartResponse, ModelOnEndResponse } from '../core/models/llm_types';
import {
  PromptTemplateOnStartResponse,
  PromptTemplateOnEndResponse,
} from '../core/promptenrichment/PromptTemplate_types';
import logger from '../logger';

import { AgentCallback } from './AgentCallback';
import {
  AgentOnStartResponse,
  AgentOnEndResponse,
  ExecutePlanOnStartResponse,
  ParsePlanResponse,
  PlanOnEndResponse,
  EvaluateStepOnStartResponse,
  EvaluateTurnOnStartResponse,
  EvaluateTurnOnEndResponse,
  FunctionCallOnStartResponse,
  FunctionCallOnEndResponse,
  EvaluateOnEndResponse,
  EvaluateOnStartResponse,
  EventEmitterCallbackParams,
} from './Agent_types';

export class AgentEventEmitterCallback extends AgentCallback {

  workspaceId: number;
  username: string;
  emitter: EventEmitter;

  constructor({ workspaceId, username, emitter }: EventEmitterCallbackParams) {
    super();
    this.workspaceId = workspaceId;
    this.username = username;
    this.emitter = emitter;
  }

  onAgentStart({ name, args, allowedTools, extraFunctionCallParams, selfEvaluate, parent }: AgentOnStartResponse) {
    let message = `[${name}] Goal: ` + args.goal;
    // if (parent) {
    //   message = `Parent '${parent}' ` + message;
    // }
    this.emitter.emit('event', message);
  }

  onAgentEnd({ name, response, errors, parent }: AgentOnEndResponse) {
    let message = `[${name}] Agent finished`;
    // if (parent) {
    //   message = `Parent '${parent}' ` + message;
    // }
    this.emitter.emit('done', message);
  }

  onAgentError(errors: any) {

  }

  onPromptTemplateStart({ messageTemplates, args }: PromptTemplateOnStartResponse) {

  }

  onPromptTemplateEnd({ messages, errors }: PromptTemplateOnEndResponse) {

  }

  onModelStartPlan({ request }: ModelOnStartResponse): void {

  }

  onModelEndPlan({ model, plan }: PlanOnEndResponse): void {
    const output = plan.reduce((a: string, step: string, i: number) => {
      a += `\n${i + 1}. ${step}`;
      return a;
    }, '');
    this.emitter.emit('event', 'Plan:' + output);

  }

  onParsePlan({ content, plan }: ParsePlanResponse) {

  }

  onExecutePlanStart({ plan }: ExecutePlanOnStartResponse) {

  }

  onExecutePlanEnd({ response, errors }: ModelOnEndResponse) {
    this.emitter.emit('event', 'Agent Response:\n' + response.choices[0].message.content);
  }

  onEvaluateStepStart({ step, index }: EvaluateStepOnStartResponse) {
    this.emitter.emit('event', `Step ${index}. ${step}`);
  }

  onEvaluateStepEnd({ response, errors }: ModelOnEndResponse) {
    this.emitter.emit('event', 'Observation:\n' + response.choices[0].message.content);
  }

  onEvaluateTurnStart({ name, index, parent }: EvaluateTurnOnStartResponse) {
    let message = `[${name}] Turn ${index + 1}`;
    // if (parent) {
    //   message = `Parent '${parent}' ` + message;
    // }
    this.emitter.emit('event', message);
  }

  onEvaluateTurnEnd(params: EvaluateTurnOnEndResponse) {

  }

  onFunctionCallStart({ name, call, args, parent }: FunctionCallOnStartResponse) {
    let message = `[${name}] Call External Tool: ` + call.name + ', args: ' + JSON.stringify(args);
    // if (parent) {
    //   message = `Parent '${parent}' ` + message;
    // }
    this.emitter.emit('event', message);
  }

  onFunctionCallEnd({ name, parent, response }: FunctionCallOnEndResponse) {
    let message = `[${name}] Tool Result: ` + JSON.stringify(response);
    this.emitter.emit('event', message);
  }

  onObserveModelStart({ request }: ModelOnStartResponse) {

  }

  onObserveModelEnd({ name, errors, parent, response }: ModelOnEndResponse) {
    const content = response.choices[0].message.content;
    let message = `[${name}] Observation: ` + content;
    if (content) {
      this.emitter.emit('event', message);
    }
  }

  onEvaluateResponseStart({ question, response, request }: EvaluateOnStartResponse) {
    this.emitter.emit('event', 'Thought: Is this a valid answer?');
  }

  onEvaluateResponseEnd({ valid, retry }: EvaluateOnEndResponse) {
    let result: string;
    if (valid) {
      result = 'Response: Yes';
    } else if (retry) {
      result = 'Response: No, let me try again.';
    } else {
      result = 'Response: No';
    }
    this.emitter.emit('event', result);
  }

}
