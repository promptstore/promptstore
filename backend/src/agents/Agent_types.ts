import EventEmitter from 'events';

import { ChatRequest, FunctionCall } from '../core/conversions/RosettaStone';

import { AgentCallback } from './AgentCallback';

export interface AgentRunParams {
  goal: string;  // the user query or goal to fulfill
  allowedTools: string[];  // the set of tool keys the agent is allowed to run
  extraFunctionCallParams: any;  // extra params required by the various tools that aren't supplied by the model
  selfEvaluate: boolean;  // a flag to enable answer evaluation by another model
  callbacks: AgentCallback[];
}

export interface AgentOnStartResponse {
  agentName: string;  // agent name
  goal: string;  // the user query or goal to fulfill
  allowedTools: string[];  // the set of tool keys the agent is allowed to run
  extraFunctionCallParams: any;  // extra params required by the various tools that aren't supplied by the model
  selfEvaluate: boolean;  // a flag to enable answer evaluation by another model
}

export interface AgentOnEndParams {
  response?: any;
  errors?: any;
}

export interface AgentOnEndResponse {
  agentName: string;
  response?: any;
  errors?: any;
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
  index: number;
  request?: ChatRequest;
}

export interface EvaluateTurnOnEndResponse {
  model: string;
  done: boolean;
  content: string;
}

export interface FunctionCallOnStartResponse {
  call: FunctionCall;
  args: any;
}

export interface FunctionCallOnEndResponse {
  response: any;
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