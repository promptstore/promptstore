import logger from '../../logger';

import { GuardrailError } from '../errors';
import { Callback } from '../callbacks/Callback';
import { convertMessagesWithImages } from '../utils';
import {
  InputGuardrailsCallParams,
  InputGuardrailsOnEndParams,
  InputGuardrailsParams,
} from './InputGuardrails_types';

export class InputGuardrails {

  guardrails: string[];
  guardrailsService: any;
  callbacks: Callback[];

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
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    this.onStart({ messages: await convertMessagesWithImages(messages) }, _callbacks);
    try {
      const contents = messages.map(m => m.content);
      const text = contents.join('\n\n');
      let valid: boolean;
      for (let key of this.guardrails) {
        let res = await this.guardrailsService.scan(key, text);
        if (res.error) {
          this.throwGuardrailError(res.error, _callbacks)
        }
        valid = true;
      }
      this.onEnd({ valid }, _callbacks);
      return valid;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ valid: false, errors }, _callbacks);
      throw err;
    }
  }

  get length() {
    return this.guardrails.length;
  }

  onStart({ messages }: InputGuardrailsCallParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onInputGuardrailStart({
        guardrails: this.guardrails,
        messages,
      })
    }
  }

  onEnd({ valid, errors }: InputGuardrailsOnEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onInputGuardrailEnd({
        valid,
        errors,
      });
    }
  }

  throwGuardrailError(message: string, callbacks: Callback[]) {
    const errors = [{ message }];
    for (let callback of callbacks) {
      callback.onInputGuardrailError(errors);
    }
    throw new GuardrailError(message);
  }

}

export const inputGuardrails = (guardrails: string[], guardrailsService: any, callbacks: Callback[]) => {
  return new InputGuardrails({ guardrails, guardrailsService, callbacks });
}
