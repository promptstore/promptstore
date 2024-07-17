import { Callback } from '../callbacks/Callback';
import { PluginMetadata } from '../common_types';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

export interface OutputProcessingStep {
  call: (params: OutputProcessingCallParams) => Promise<object>;
  callbacks?: Callback[];
}

export interface OutputProcessingCallParams {
  response: any;
  callbacks?: Callback[];
}

export interface OutputProcessingEndParams {
  response?: any;
  errors?: any;
}

export interface OutputProcessingResponse {
  response?: any;
  errors?: any;
}

export type OutputProcessingOnStartCallbackFunction = (params: OutputProcessingResponse) => void;

export type OutputProcessingOnEndCallbackFunction = (params: OutputProcessingResponse) => void;

export type OutputProcessingOnErrorCallbackFunction = (errors: any) => void;

export interface OutputProcessingPipelineParams {
  steps: OutputProcessingStep[];
  callbacks?: Callback[];
}

export interface OutputGuardrailParams {
  guardrail: string;
  guardrailsService: any;
  callbacks?: Callback[];
}

export interface OutputParserParams {
  outputParser: string;
  parserService: any;
  callbacks?: Callback[];
}

export interface OutputGuardrailStartResponse {
  guardrail: string;
  response: any;
}

export interface OutputParserStartResponse {
  outputParser: string;
  response: any;
}

interface ParserResult {
  error: Error;
  fixed: boolean;
  json: any;
  nonJsonStr: string;
  retriable: boolean;
}

export interface ParserService {

  parse(provider: string, text: string): Promise<Partial<ParserResult>>;

  getOutputParsers(): PluginMetadata[];

}

export interface Parser {

  __name: string;

  parse(text: string): Promise<Partial<ParserResult>>;

}

export interface Ruleset {
  id: string;
  ontology: any;
}

export interface RulesetsGuardrailParams {
  rulesets: Ruleset[];
  semanticFunction: SemanticFunction;
  rulesEngineService: any;
  callbacks?: Callback[];
}

export interface RulesetsGuardrailStartResponse {
  response: any;
  rulesets: Ruleset[];
}
