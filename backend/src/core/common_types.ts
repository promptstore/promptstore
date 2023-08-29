import { Callback } from './Callback';
import { ValidatorResult } from 'jsonschema';

export interface Model {
  modelType: string;
  model: string;
  callbacks: Callback[];
  call: (params: any) => Promise<any>;
}

export type DataMapper = (instance: object, template: any) => Promise<object>;

export type Constructor = new (...args: any[]) => {};
export type GConstructor<T = {}> = new (...args: any[]) => T;

export type Validator = (args: any, schema: object, options: object) => ValidatorResult;

export interface Source {
  type: string;
  name?: string;
}

export interface MapArgumentsResponse {
  args: any;
  mapped?: any;
  isBatch: boolean;
  mappingTemplate: any;
  source?: Source,
  errors?: any;
}

export interface MapReturnTypeResponse {
  response: any;
  mapped?: any;
  isBatch: boolean;
  mappingTemplate: any;
  errors?: any;
}
