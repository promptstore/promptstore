import { ModelOnStartResponse, ModelOnEndResponse } from '../core/models/llm_types';
import {
  PromptTemplateOnStartResponse,
  PromptTemplateOnEndResponse,
} from '../core/promptenrichment/PromptTemplate_types';
import { TraceCallbackParams } from '../core/tracing/Tracer_types';
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
} from './Agent_types';

export class AgentDebugCallback extends AgentCallback {

  workspaceId: number;
  username: string;

  constructor({ workspaceId, username }: TraceCallbackParams) {
    super();
    this.workspaceId = workspaceId;
    this.username = username;
  }

  onAgentStart({ agentName, goal, allowedTools, extraFunctionCallParams, selfEvaluate }: AgentOnStartResponse) {
    const startTime = new Date();
    const traceName = [agentName, startTime.toISOString()].join(' - ');
    logger.debug('start agent', traceName);
  }

  onAgentEnd({ agentName, response, errors }: AgentOnEndResponse) {
    logger.debug('end agent', agentName);
  }

  onAgentError(errors: any) {
    logger.error(errors);
  }

  onPromptTemplateStart({ messageTemplates, args }: PromptTemplateOnStartResponse) {
    logger.debug('start filling template');
  }

  onPromptTemplateEnd({ messages, errors }: PromptTemplateOnEndResponse) {
    logger.debug('end filling template');
  }

  onModelStartPlan({ request }: ModelOnStartResponse): void {
    const { model, model_params, prompt } = request;
    logger.debug('get plan using model:', model, model_params);
    if (prompt.context) {
      logger.debug('context:', prompt.context.system_prompt);
    }
    if (prompt.history) {
      logger.debug('history:', prompt.history);
    }
    logger.debug('messages:', prompt.messages);
  }

  onModelEndPlan({ model, plan }: PlanOnEndResponse): void {
    logger.debug('end model:', model);
    const output = plan.reduce((a: string, step: string, i: number) => {
      a += `\n${i + 1}. ${step}`;
      return a;
    }, '');
    logger.debug('output:\n', output);
  }

  onParsePlan({ content, plan }: ParsePlanResponse) {
    logger.debug('parsing "%s"', content);
    logger.debug('output:', plan);
  }

  onExecutePlanStart({ plan }: ExecutePlanOnStartResponse) {
    logger.debug('start execution loop');
  }

  onExecutePlanEnd({ response, errors }: ModelOnEndResponse) {
    logger.debug('executed plan');
  }

  onEvaluateStepStart({ step, request }: EvaluateStepOnStartResponse) {
    logger.debug('evaluating step:', step);
    // const functions = request.functions;
    // logger.debug('functions:', functions || 'none selected');
  }

  onEvaluateStepEnd({ response, errors }: ModelOnEndResponse) {
    logger.debug('evaluated step:', response.choices[0].message.content);
  }

  onEvaluateTurnStart({ index, request }: EvaluateTurnOnStartResponse) {
    logger.debug('evaluating turn', index);
    // const functions = request.functions;
    // logger.debug('functions:', functions || 'none selected');
  }

  onEvaluateTurnEnd({ done, content }: EvaluateTurnOnEndResponse) {
    logger.debug('evaluated turn');
    logger.debug('done:', done ? 'Yes' : 'No');
    logger.debug('content:', content);
  }

  onFunctionCallStart({ call, args }: FunctionCallOnStartResponse) {
    logger.debug('calling tool:', call.name);
    logger.debug('args:', args);
  }

  onFunctionCallEnd({ response }: FunctionCallOnEndResponse) {
    logger.debug('tool result:', response);
  }

  onObserveModelStart({ request }: ModelOnStartResponse) {
    const { model, model_params, prompt } = request;
    logger.debug('get observation using model:', model, model_params);
    // if (prompt.context) {
    //   logger.debug('context:', prompt.context.system_prompt);
    // }
    // if (prompt.history) {
    //   logger.debug('history:', prompt.history);
    // }
    // logger.debug('messages:', prompt.messages);
  }

  onObserveModelEnd({ response, errors }: ModelOnEndResponse) {
    logger.debug('end model:', response.model);
    // logger.debug('output:', response);
  }

  onEvaluateResponseStart({ question, response, request }: EvaluateOnStartResponse) {
    logger.debug('evaluating response to question:', question);
    logger.debug('response:', response);
  }

  onEvaluateResponseEnd({ valid, retry }: EvaluateOnEndResponse) {
    logger.debug('valid response:', valid ? 'Yes' : 'No');
  }

}
