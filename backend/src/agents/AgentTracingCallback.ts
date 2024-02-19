import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import uuid from 'uuid';

import { ModelOnStartResponse, ModelOnEndResponse } from '../core/models/llm_types';
import {
  PromptTemplateOnStartResponse,
  PromptTemplateOnEndResponse,
} from '../core/promptenrichment/PromptTemplate_types';
import { Tracer } from '../core/tracing/Tracer';
import { TraceCallbackParams } from '../core/tracing/Tracer_types';

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

dayjs.extend(relativeTime);

export class AgentTracingCallback extends AgentCallback {

  workspaceId: number;
  username: string;
  tracesService: any;
  tracer: Tracer;
  startTime: Date[];

  constructor({ workspaceId, username, tracesService }: TraceCallbackParams) {
    super();
    this.workspaceId = workspaceId;
    this.username = username;
    this.tracesService = tracesService;
    this.startTime = [];
  }

  onAgentStart({ agentName, goal, allowedTools, extraFunctionCallParams, selfEvaluate }: AgentOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    const traceName = [agentName, startTime.toISOString()].join(' - ');
    this.tracer = new Tracer(traceName, 'agent');
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'plan-and-execute agent',
        agentName,
        goal,
        allowedTools,
        extraFunctionCallParams,
        selfEvaluate,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onAgentEnd({ response, errors }: AgentOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
    const traceRecord = this.tracer.close();
    this.tracesService.upsertTrace({ ...traceRecord, workspaceId: this.workspaceId }, this.username);
  }

  onAgentError(errors: any) {
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onPromptTemplateStart({ messageTemplates, args, isBatch }: PromptTemplateOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-prompt-template',
        messageTemplates,
        args,
        isBatch,
        startTime: startTime.getTime(),
      });
  }

  onPromptTemplateEnd({ messages, errors }: PromptTemplateOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('messages', messages)
        .addProperty('success', true)
        ;
    }
  }

  onModelStartPlan({ request }: ModelOnStartResponse): void {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-model: plan',
        ...request,
        modelParams: request.model_params,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onModelEndPlan({ plan, errors }: PlanOnEndResponse): void {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('plan', plan)
        .addProperty('success', true)
        ;
    }
  }

  onParsePlan({ content, plan }: ParsePlanResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'parse-plan',
        content,
        plan,
        startTime: startTime.getTime(),
      });
  }

  onExecutePlanStart({ plan }: ExecutePlanOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'execute-plan',
        plan,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onExecutePlanEnd({ response, errors }: ModelOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
  }

  onEvaluateStepStart({ step, index, request }: EvaluateStepOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'evaluate-step',
        step,
        index,
        ...request,
        modelParams: request.model_params,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onEvaluateStepEnd({ response, errors }: ModelOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      const call = response.choices[0].message.function_call;
      this.tracer
        .addProperty('response', response)
        .addProperty('call', call)
        .addProperty('success', true)
        ;
    }
  }

  onEvaluateTurnStart({ index, request }: EvaluateTurnOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'evaluate-turn',
        index,
        ...request,
        modelParams: request?.model_params,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onEvaluateTurnEnd({ done, content }: EvaluateTurnOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      .addProperty('done', done)
      .addProperty('content', content)
      .addProperty('success', true)
      ;
  }

  onFunctionCallStart({ call, args }: FunctionCallOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-tool',
        call,
        args,
        startTime: startTime.getTime(),
      });
  }

  onFunctionCallEnd({ response }: FunctionCallOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      .addProperty('response', response)
      .addProperty('success', true)
      ;
  }

  onObserveModelStart({ request }: ModelOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-model: observe',
        ...request,
        modelParams: request.model_params,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onObserveModelEnd({ response, errors }: ModelOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
  }

  onEvaluateResponseStart({ question, request, response }: EvaluateOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'evaluate-response',
        question,
        response,
        request,
        startTime: startTime.getTime(),
      });
  }

  onEvaluateResponseEnd({ valid, retry }: EvaluateOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      .addProperty('valid', valid)
      .addProperty('success', true)
      ;
  }

}
