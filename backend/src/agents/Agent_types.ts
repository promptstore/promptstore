import EventEmitter from 'events';

import { ChatRequest, ContentType, FunctionCall, ModelParams } from '../core/conversions/RosettaStone';

import { AgentCallback } from './AgentCallback';

export interface AgentRunParams {
  args: any;
  allowedTools: string[];  // the set of tool keys the agent is allowed to run
  extraFunctionCallParams: any;  // extra params required by the various tools that aren't supplied by the model
  selfEvaluate: boolean;  // a flag to enable answer evaluation by another model
  callbacks: AgentCallback[];
  parentAgentName?: string;
}

export interface Agent {

  run: ({
    args,
    allowedTools,
    extraFunctionCallParams,
    selfEvaluate,
    callbacks,
  }: Partial<AgentRunParams>) => Promise<ContentType>;

}

export interface AgentOnStartResponse {
  name: string;  // agent name
  args: any;
  allowedTools: string[];  // the set of tool keys the agent is allowed to run
  extraFunctionCallParams: any;  // extra params required by the various tools that aren't supplied by the model
  selfEvaluate: boolean;  // a flag to enable answer evaluation by another model
  parent?: string;
  model?: string;
  modelParams?: Partial<ModelParams>;
}

export interface AgentOnEndParams {
  response?: any;
  errors?: any;
}

export interface AgentOnEndResponse {
  name: string;
  response?: any;
  errors?: any;
  parent?: string;
}

export interface ParsePlanResponse {
  content: string;
  plan: string;
}

export interface PlanOnEndResponse {
  model: string;
  plan?: string[];
  errors?: any;
}

export interface ExecutePlanOnStartResponse {
  plan: string;
}

export interface EvaluateStepOnStartResponse {
  step: string;
  index: number;
  request: ChatRequest;
}

export interface EvaluateTurnOnStartResponse {
  name?: string;
  index: number;
  request?: ChatRequest;
  parent?: string;
}

export interface EvaluateTurnOnEndResponse {
  model: string;
  done: boolean;
  content: string;
}

export interface FunctionCallOnStartResponse {
  name?: string;
  call: FunctionCall;
  args: any;
  parent?: string;
}

export interface FunctionCallOnEndResponse {
  name?: string;
  response: any;
  parent?: string;
}

export interface EvaluateOnStartResponse {
  question: string;
  response: string;
  request: ChatRequest;
}

export interface EvaluateOnEndResponse {
  valid: boolean;
  retry: boolean;
}

export interface EventEmitterCallbackParams {
  workspaceId: number;
  username: string;
  emitter: EventEmitter;
}

interface ToolParameters {
  properties: any;
}

interface ToolMetadata {
  name: string;
  description: string;
  parameters: ToolParameters;
}

export interface Tool {
  __name: string;
  __description: string;
  call: (args: any, raw: boolean) => Promise<string>;
  getOpenAPIMetadata: () => ToolMetadata;
}