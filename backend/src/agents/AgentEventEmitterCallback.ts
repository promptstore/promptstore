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

  onAgentStart({ agentName, goal, allowedTools, extraFunctionCallParams, selfEvaluate }: AgentOnStartResponse) {
    this.emitter.emit('event', 'Goal:\n' + goal);
  }

  onAgentEnd({ agentName, response, errors }: AgentOnEndResponse) {
    this.emitter.emit('done', 'Agent finished');
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

  onEvaluateTurnStart({ index }: EvaluateTurnOnStartResponse) {
    this.emitter.emit('event', `Turn ${index + 1}`);
  }

  onEvaluateTurnEnd(params: EvaluateTurnOnEndResponse) {

  }

  onFunctionCallStart({ call, args }: FunctionCallOnStartResponse) {
    this.emitter.emit('event', 'Call External Tool: ' + call.name + ', args: ' + JSON.stringify(args));
  }

  onFunctionCallEnd({ response }: FunctionCallOnEndResponse) {
    this.emitter.emit('event', 'Tool Result: ' + response);
  }

  onObserveModelStart({ request }: ModelOnStartResponse) {

  }

  onObserveModelEnd({ response, errors }: ModelOnEndResponse) {
    // this.emitter.emit('event', 'Observation:\n' + response.choices[0].message.content);
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
