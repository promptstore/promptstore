import { Callback } from './Callback';
import { IMessage } from './PromptTemplate_types';

export interface InputGuardrailsParams {
  guardrails: string[];
  guardrailsService: any;
  callbacks?: Callback[];
}

export interface InputGuardrailsCallParams {
  messages: IMessage[];
  callbacks?: Callback[];
}

export interface InputGuardrailsOnEndParams {
  valid?: boolean;
  errors?: any;
}

export interface InputGuardrailsOnStartResponse {
  guardrails: string[];
  messages: IMessage[];
}

export interface InputGuardrailsOnEndResponse {
  valid: boolean;
  errors?: any;
}
