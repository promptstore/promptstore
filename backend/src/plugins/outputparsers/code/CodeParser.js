function CodeParser({ __name, __metadata, constants, logger }) {

  async function parse(text) {
    logger.debug('parsing:', text);
    if (!text) {
      return {
        error: { message: 'Nothing to parse' },
        nonJsonStr: text,
      };
    }
    try {
      let code;
      if (text.includes('```')) {
        code = text.split(/```(?:\w+)?/)[1].trim();
      }
      return { json: code, nonJsonStr: text };

    } catch (err) {
      let message = `Error parsing text "${text}": ` + err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return {
        error: { message },
        nonJsonStr: text,
      };
    }
  }

  return {
    __name,
    __metadata,
    parse,
  };

}

export default CodeParser;
