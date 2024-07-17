import {
  ModelOnStartResponse,
  ModelOnEndResponse,
} from '../core/models/llm_types';
import {
  PromptTemplateOnStartResponse,
  PromptTemplateOnEndResponse,
} from '../core/promptenrichment/PromptTemplate_types';

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

export class AgentCallback {

  onAgentStart(params: Partial<AgentOnStartResponse>) {

  }

  onAgentEnd(params: AgentOnEndResponse) {

  }

  onAgentError(errors: any) {

  }

  onPromptTemplateStart(params: PromptTemplateOnStartResponse) {

  }

  onPromptTemplateEnd(params: PromptTemplateOnEndResponse) {

  }

  onModelStartPlan(params: ModelOnStartResponse) {

  }

  onModelEndPlan(params: PlanOnEndResponse) {

  }

  onParsePlan(params: ParsePlanResponse) {

  }

  onExecutePlanStart(params: ExecutePlanOnStartResponse) {

  }

  onExecutePlanEnd(params: ModelOnEndResponse) {

  }

  onEvaluateStepStart(params: EvaluateStepOnStartResponse) {

  }

  onEvaluateStepEnd(params: ModelOnEndResponse) {

  }

  onEvaluateTurnStart(params: EvaluateTurnOnStartResponse) {

  }

  onEvaluateTurnEnd(params: EvaluateTurnOnEndResponse) {

  }

  onFunctionCallStart(params: FunctionCallOnStartResponse) {

  }

  onFunctionCallEnd(params: FunctionCallOnEndResponse) {

  }

  onObserveModelStart(params: ModelOnStartResponse) {

  }

  onObserveModelEnd(params: ModelOnEndResponse) {

  }

  onEvaluateResponseStart(params: EvaluateOnStartResponse) {

  }

  onEvaluateResponseEnd(params: EvaluateOnEndResponse) {

  }

}
