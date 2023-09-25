import { Callback } from '../callbacks/Callback';
import { OpenAIMessage } from '../models/openai_types';

export interface InputGuardrailsParams {
  guardrails: string[];
  guardrailsService: any;
  callbacks?: Callback[];
}

export interface InputGuardrailsCallParams {
  messages: OpenAIMessage[];
  callbacks?: Callback[];
}

export interface InputGuardrailsOnEndParams {
  valid?: boolean;
  errors?: any;
}

export interface InputGuardrailsOnStartResponse {
  guardrails: string[];
  messages: OpenAIMessage[];
}

export interface InputGuardrailsOnEndResponse {
  valid: boolean;
  errors?: any;
}
