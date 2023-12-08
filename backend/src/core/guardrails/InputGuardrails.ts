import logger from '../../logger';

import { GuardrailError } from '../errors';
import { Callback } from '../callbacks/Callback';
import {
  InputGuardrailsCallParams,
  InputGuardrailsOnEndParams,
  InputGuardrailsParams,
} from './InputGuardrails_types';

export class InputGuardrails {

  guardrails: string[];
  guardrailsService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    guardrails,
    guardrailsService,
    callbacks,
  }: InputGuardrailsParams) {
    this.guardrails = guardrails;
    this.guardrailsService = guardrailsService;
    this.callbacks = callbacks;
  }

  async call({ messages, callbacks }: InputGuardrailsCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ messages });
    try {
      const contents = messages.map(m => m.content);
      const text = contents.join('\n\n');
      let valid: boolean;
      for (let key of this.guardrails) {
        let res = await this.guardrailsService.scan(key, text);
        if (res.error) {
          this.throwGuardrailError(res.error)
        }
        valid = true;
      }
      this.onEnd({ valid });
      return valid;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ valid: false, errors });
      throw err;
    }
  }

  get length() {
    return this.guardrails.length;
  }

  onStart({ messages }: InputGuardrailsCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onInputGuardrailStart({
        guardrails: this.guardrails,
        messages,
      })
    }
  }

  onEnd({ valid, errors }: InputGuardrailsOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onInputGuardrailEnd({
        valid,
        errors,
      });
    }
  }

  throwGuardrailError(message: string) {
    const errors = [{ message }];
    for (let callback of this.currentCallbacks) {
      callback.onInputGuardrailError(errors);
    }
    throw new GuardrailError(message);
  }

}

export const inputGuardrails = (guardrails: string[], guardrailsService: any, callbacks: Callback[]) => {
  return new InputGuardrails({ guardrails, guardrailsService, callbacks });
}
