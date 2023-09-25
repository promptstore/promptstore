import { SchemaError } from './errors';
import { GConstructor, Validator } from './common_types';

type Validatable = GConstructor<{ validator: Validator }>;

export type Validating = { validate: (args: object, schema: object) => void };

export function withValidation<TBase extends Validatable>(Base: TBase) {

  return class extends Base {

    validate(instance: object, schema: object) {
      const validatorResult = this.validator(instance, schema, { required: true });
      if (!validatorResult.valid) {
        throw new SchemaError(validatorResult);
      }
    }

  }

}
