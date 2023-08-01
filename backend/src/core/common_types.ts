import { ValidatorResult } from 'jsonschema';

export type ChatCompletionResponse = any;

export type DataMapper = (instance: object, template: any) => Promise<object>;

export type Constructor = new (...args: any[]) => {};
export type GConstructor<T = {}> = new (...args: any[]) => T;

export type Validator = (args: any, schema: object, options: object) => ValidatorResult;
