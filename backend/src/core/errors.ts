import { ValidatorResult } from 'jsonschema';

export class CompositionError extends Error {

  constructor(message: string) {
    super(message);
  }

  get errors() {
    return [{ message: this.message }];
  }

}

export class GuardrailError extends Error {

  constructor(message: string) {
    super(message);
  }

  get errors() {
    return [{ message: this.message }];
  }

}

export class ParserError extends Error {

  constructor(message: string) {
    super(message);
  }

  get errors() {
    return [{ message: this.message }];
  }

}

export class SemanticFunctionError extends Error {

  constructor(message: string) {
    super(message);
  }

  get errors() {
    return [{ message: this.message }];
  }

}

export class SchemaError extends Error {

  validatorResult: ValidatorResult;

  constructor(validatorResult: ValidatorResult) {
    super('args failed validation');
    this.validatorResult = validatorResult;
  }

  get errors() {
    return this.validatorResult.errors;
  }

}
