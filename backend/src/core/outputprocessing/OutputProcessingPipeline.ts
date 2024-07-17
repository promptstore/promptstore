import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import clone from 'lodash.clonedeep';
import set from 'lodash.set';  // mutable
import trim from 'lodash.trim';

import logger from '../../logger';

import { GuardrailError, ParserError } from '../errors';
import { Callback } from '../callbacks/Callback';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';
import {
  OutputProcessingCallParams,
  OutputProcessingEndParams,
  OutputProcessingPipelineParams,
  OutputProcessingStep,
  OutputGuardrailParams,
  OutputParserParams,
  OutputGuardrailStartResponse,
  OutputParserStartResponse,
  Ruleset,
  RulesetsGuardrailParams,
  RulesetsGuardrailStartResponse,
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

export class RulesetsGuardrail implements OutputProcessingStep {

  rulesets: Ruleset[];
  semanticFunction: SemanticFunction;
  rulesEngineService: any;
  callbacks: Callback[];

  constructor({
    rulesets,
    semanticFunction,
    rulesEngineService,
    callbacks,
  }: RulesetsGuardrailParams) {
    this.rulesets = rulesets;
    this.semanticFunction = semanticFunction;
    this.rulesEngineService = rulesEngineService;
    this.callbacks = callbacks || [];
  }

  async call({ response, callbacks }: OutputProcessingCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    this.onStart({ response, rulesets: this.rulesets }, _callbacks);
    for (const { id, ontology } of this.rulesets) {
      const schema = this.getOntologySchema(ontology);
      const content = this.getContent(response);
      const res = await this.semanticFunction.call({
        args: {
          facts: JSON.stringify(schema),
          content,
        },
        model: {
          provider: 'openai',
          model: 'gpt-4-0125-preview',
        },
        modelParams: { max_tokens: 4096 },
        isBatch: false,
        callbacks: _callbacks,
      });
      const data = JSON.parse(res.response.choices[0].message.function_call.arguments);
      const matchingRulesets = await this.rulesEngineService.run(data);
      const pass = matchingRulesets.includes(id);
      if (!pass) {
        this.throwGuardrailError('rules check failed', _callbacks);
      }
    }
    this.onEnd({ response }, _callbacks);
    return response;
  }

  getOntologySchema({ edges = [], nodes }) {
    const props = {};
    for (const el of [...nodes, ...edges]) {
      const { description, label, properties } = el.data;
      if (properties?.length) {
        props[label] = {
          type: 'object',
          description,
          properties: properties.reduce((a: any, p: any) => {
            let type: string;
            if (p.dataType === 'tag') {
              type = 'string';
            } else {
              type = p.dataType;
            }
            a[p.property] = { type };
            return a;
          }, {}),
        }
      }
    }
    const schema = {
      type: 'object',
      properties: props,
    };
    return schema;
  }

  getOntologySchemaX({ edges = [], nodes }) {
    const props = {};
    for (const node of nodes) {
      const { description, label, properties } = node.data;
      if (properties?.length) {
        props[label] = {
          type: 'object',
          description,
          properties: properties.reduce((a: any, p: any) => {
            let type: string;
            if (p.dataType === 'tag') {
              type = 'string';
            } else {
              type = p.dataType;
            }
            a[p.property] = { type };
            return a;
          }, {}),
        }
      }
    }
    for (const edge of edges) {
      const source = nodes.find((n: any) => n.id === edge.source);
      const target = nodes.find((n: any) => n.id === edge.target);
      if (source && target) {
        const { description, label, properties = [] } = edge.data;
        props[source.data.label] = {
          ...props[source.data.label],
          properties: {
            ...props[source.data.label].properties,
            [label + '_' + target.data.label]: {
              type: 'object',
              description,
              properties: {
                label: {
                  type: 'string',
                  description: "the related object's name",
                },
                ...properties.reduce((a: any, p: any) => {
                  let type: string;
                  if (p.dataType === 'tag') {
                    type = 'string';
                  } else {
                    type = p.dataType;
                  }
                  a[p.property] = { type };
                  return a;
                }, {}),
              }
            }
          }
        }
      }
    }
    const schema = {
      type: 'object',
      properties: props,
    };
    return schema;
  }

  getContent(response: any) {
    return response.choices[0].message.content;
  }

  onStart({ response, rulesets }: RulesetsGuardrailStartResponse, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onRulesetsGuardrailStart({
        response,
        rulesets,
      });
    }
  }

  onEnd({ response, errors }: OutputProcessingEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onRulesetsGuardrailEnd({
        response,
        errors,
      });
    }
  }

  throwGuardrailError(message: string, callbacks: Callback[]) {
    const errors = [{ message }];
    for (let callback of callbacks) {
      callback.onRulesetsGuardrailError(errors);
    }
    throw new GuardrailError(message);
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
};

export const outputGuardrail = (options: OutputGuardrailParams) => {
  return new OutputGuardrail(options);
};

export const outputParser = (options: OutputParserParams) => {
  return new OutputParser(options);
};

export const rulesetsGuardrail = (options: RulesetsGuardrailParams) => {
  return new RulesetsGuardrail(options);
};
