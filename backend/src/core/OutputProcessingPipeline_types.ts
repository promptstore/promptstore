import { Callback } from './Callback';
// import { Tracer, Trace } from './Tracer';

export interface OutputProcessingStep {
  call: (result: any) => Promise<object>;
  // tracer?: Tracer;
  callbacks?: Callback[];
}

export interface OutputProcessingCallParams {
  result: any;
  callbacks?: Callback[];
}

export interface OutputProcessingEndParams {
  result?: any;
  errors?: any;
}

export interface OutputProcessingResponse {
  result?: any;
  errors?: any;
  // trace: Trace;
}

export type OutputProcessingOnStartCallbackFunction = (params: OutputProcessingResponse) => void;

export type OutputProcessingOnEndCallbackFunction = (params: OutputProcessingResponse) => void;

export type OutputProcessingOnErrorCallbackFunction = (errors: any) => void;

export interface OutputProcessingPipelineParams {
  steps: OutputProcessingStep[];
  callbacks?: Callback[];
}
