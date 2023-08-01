import { ValidatorResult } from 'jsonschema';

export class SemanticFunctionError extends Error {

  constructor(message: string) {
    super(message);
  }

}

export class SchemaError extends Error {

  validatorResult: ValidatorResult;

  constructor(validatorResult: ValidatorResult) {
    super('args failed validation');
    this.validatorResult = validatorResult;
  }

}
