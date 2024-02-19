import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import clone from 'lodash.clonedeep';
import set from 'lodash.set';  // mutable
import trim from 'lodash.trim';

import logger from '../../logger';

import { GuardrailError, ParserError } from '../errors';
import { Callback } from '../callbacks/Callback';
import {
  OutputProcessingCallParams,
  OutputProcessingEndParams,
  OutputProcessingPipelineParams,
  OutputProcessingStep,
  OutputGuardrailParams,
  OutputParserParams,
  OutputGuardrailStartResponse,
  OutputParserStartResponse,
} from './OutputProcessingPipeline_types';

dayjs.extend(relativeTime);

export class OutputProcessingPipeline {

  steps: OutputProcessingStep[];
  callbacks: Callback[];

  constructor({
    steps,
    callbacks,
  }: OutputProcessingPipelineParams) {
    this.steps = steps;
    this.callbacks = callbacks || [];
  }

  async call({ response, callbacks }: OutputProcessingCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    this.onStart({ response }, _callbacks);
    try {
      for (const step of this.steps) {
        response = await step.call({ response, callbacks: _callbacks });
      }
      this.onEnd({ response }, _callbacks);
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors }, _callbacks);
      throw err;
    }
  }

  get length() {
    return this.steps.length;
  }

  onStart({ response }: OutputProcessingCallParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onOutputProcessingStart({
        response,
      });
    }
  }

  onEnd({ response, errors }: OutputProcessingEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onOutputProcessingEnd({
        response,
        errors,
      });
    }
  }

}

export class OutputGuardrail implements OutputProcessingStep {

  guardrail: string;
  guardrailsService: any;
  callbacks: Callback[];

  constructor({
    guardrail,
    guardrailsService,
    callbacks,
  }: OutputGuardrailParams) {
    this.guardrail = guardrail;
    this.guardrailsService = guardrailsService;
    this.callbacks = callbacks || [];
  }

  async call({ response, callbacks }: OutputProcessingCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    this.onStart({ guardrail: this.guardrail, response }, _callbacks);
    try {
      const content = this.getContent(response);
      const res = await this.guardrailsService.scan(this.guardrail, content);
      if (res.error) {
        this.throwGuardrailError(res.error, _callbacks);
      }
      response = this.updateContent(response, res.text);
      this.onEnd({ response }, _callbacks)
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors }, _callbacks);
      throw err;
    }
  }

  getContent(response: any) {
    return response.choices[0].message.content;
  }

  updateContent(response: any, content: string) {
    return set(clone(response), 'choices[0].message.content', content);
  }

  onStart({ guardrail, response }: OutputGuardrailStartResponse, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onOutputGuardrailStart({
        guardrail,
        response,
      });
    }
  }

  onEnd({ response, errors }: OutputProcessingEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onOutputGuardrailEnd({
        response,
        errors,
      });
    }
  }

  throwGuardrailError(message: string, callbacks: Callback[]) {
    const errors = [{ message }];
    for (let callback of callbacks) {
      callback.onOutputGuardrailError(errors);
    }
    throw new GuardrailError(message);
  }

}

export class OutputParser implements OutputProcessingStep {

  outputParser: string;
  parserService: any;
  callbacks: Callback[];

  constructor({
    outputParser,
    parserService,
    callbacks,
  }: OutputParserParams) {
    this.outputParser = outputParser;
    this.parserService = parserService;
    this.callbacks = callbacks || [];
  }

  async call({ response, callbacks }: OutputProcessingCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    this.onStart({ outputParser: this.outputParser, response }, _callbacks);
    try {
      const content = this.getContent(response);
      const { error, json } = await this.parserService.parse(this.outputParser, content);
      if (error) {
        this.throwParserError(error, _callbacks);
      }
      response = this.updateContent(response, JSON.stringify(json));
      this.onEnd({ response }, _callbacks)
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors }, _callbacks);
      throw err;
    }
  }

  getContent(response: any) {
    return response.choices[0].message.content;
  }

  updateContent(response: any, content: string) {
    content = trim(content, '"');
    return set(clone(response), 'choices.0.message.content', content);
  }

  onStart({ outputParser, response }: OutputParserStartResponse, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onOutputParserStart({
        outputParser,
        response,
      });
    }
  }

  onEnd({ response, errors }: OutputProcessingEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onOutputParserEnd({
        response,
        errors,
      });
    }
  }

  throwParserError(message: string, callbacks: Callback[]) {
    const errors = [{ message }];
    for (let callback of callbacks) {
      callback.onOutputParserError(errors);
    }
    throw new ParserError(message);
  }

}

type OutputProcessingComponent = OutputProcessingStep | OutputProcessingStep[];

interface OutputProcessingPipelineOptions {
  callbacks?: Callback[];
}

export const outputProcessingPipeline = (options: OutputProcessingPipelineOptions) => (...components: OutputProcessingComponent[]) => {
  let steps: OutputProcessingStep[];
  if (Array.isArray(components[0])) {
    steps = components[0];
  } else {
    steps = components as OutputProcessingStep[];
  }
  return new OutputProcessingPipeline({
    ...options,
    steps
  });
}

export const outputGuardrail = (options: OutputGuardrailParams) => {
  return new OutputGuardrail(options);
}

export const outputParser = (options: OutputParserParams) => {
  return new OutputParser(options);
}
