import { Parser } from 'expr-eval';

function Calculator({ __key, __name, constants, logger }) {

  async function call({ input }) {
    logger.debug('evaluating input:', input);
    try {
      return Parser.evaluate(input).toString();
    } catch (err) {
      logger.error(`error evaluating calculator input "${input}":`, err);
      return "I don't know how to do that.";
    }
  }

  function getOpenAIMetadata() {
    return {
      name: __key,
      description: constants.CALCULATOR_DESCRIPTION,
      parameters: {
        properties: {
          input: {
            description: 'Input text',
            type: 'string',
          },
        },
        required: ['input'],
        type: 'object',
      },
    };
  }

  return {
    __name,
    __description: constants.CALCULATOR_DESCRIPTION,
    call,
    getOpenAIMetadata,
  };
}

export default Calculator;