function LastLineParser({ __name, __metadata, constants, logger, app, auth }) {

  /**
   * 
   * @param {*} text 
   * @returns 
   */
  async function parse(text) {
    logger.debug('parsing:', text);
    if (!text) {
      return {
        error: { message: 'Nothing to parse' },
        nonJsonStr: text,
      };
    }
    try {
      const lastline = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .pop();

      return { json: lastline };

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

export default LastLineParser;
