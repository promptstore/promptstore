import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import set from 'lodash.set';  // mutable
import clone from 'lodash.clonedeep';

import { GuardrailError, ParserError } from './errors';
import { Callback } from './Callback';
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
  currentCallbacks: Callback[];

  constructor({
    steps,
    callbacks,
  }: OutputProcessingPipelineParams) {
    this.steps = steps;
    this.callbacks = callbacks || [];
  }

  async call({ response, callbacks = [] }: OutputProcessingCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ response });
    try {
      for (const step of this.steps) {
        response = await step.call({ response, callbacks });
      }
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  onStart({ response }: OutputProcessingCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onOutputProcessingStart({
        response,
      });
    }
  }

  onEnd({ response, errors }: OutputProcessingEndParams) {
    for (let callback of this.currentCallbacks) {
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
  currentCallbacks: Callback[];

  constructor({
    guardrail,
    guardrailsService,
    callbacks,
  }: OutputGuardrailParams) {
    this.guardrail = guardrail;
    this.guardrailsService = guardrailsService;
    this.callbacks = callbacks || [];
  }

  async call({ response, callbacks = [] }: OutputProcessingCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ guardrail: this.guardrail, response });
    try {
      const content = this.getContent(response);
      const res = await this.guardrailsService.scan(this.guardrail, content);
      if (res.error) {
        this.throwGuardrailError(res.error);
      }
      response = this.updateContent(response, res.text);
      this.onEnd({ response })
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getContent(response: any) {
    return response.choices[0].message.content;
  }

  updateContent(response: any, content: string) {
    return set(clone(response), 'choices[0].message.content', content);
  }

  onStart({ guardrail, response }: OutputGuardrailStartResponse) {
    for (let callback of this.currentCallbacks) {
      callback.onOutputGuardrailStart({
        guardrail,
        response,
      });
    }
  }

  onEnd({ response, errors }: OutputProcessingEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onOutputGuardrailEnd({
        response,
        errors,
      });
    }
  }

  throwGuardrailError(message: string) {
    const errors = [{ message }];
    for (let callback of this.currentCallbacks) {
      callback.onOutputGuardrailError(errors);
    }
    throw new GuardrailError(message);
  }

}

export class OutputParser implements OutputProcessingStep {

  outputParser: string;
  parserService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    outputParser,
    parserService,
    callbacks,
  }: OutputParserParams) {
    this.outputParser = outputParser;
    this.parserService = parserService;
    this.callbacks = callbacks || [];
  }

  async call({ response, callbacks = [] }: OutputProcessingCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ outputParser: this.outputParser, response });
    try {
      const res = await this.parserService.parse(this.outputParser, response);
      if (res.error) {
        this.throwParserError(res.error);
      }
      response = res.text;
      this.onEnd({ response })
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  onStart({ outputParser, response }: OutputParserStartResponse) {
    for (let callback of this.currentCallbacks) {
      callback.onOutputParserStart({
        outputParser,
        response,
      });
    }
  }

  onEnd({ response, errors }: OutputProcessingEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onOutputParserEnd({
        response,
        errors,
      });
    }
  }

  throwParserError(message: string) {
    const errors = [{ message }];
    for (let callback of this.currentCallbacks) {
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
