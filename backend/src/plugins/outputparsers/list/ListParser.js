function ListParser({ __name, __metadata, constants, logger, app, auth }) {

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
      const list = lastline
        .replace(/"/g, '')
        .split(/\s*,\s*/);

      return { json: list };

    } catch (err) {
      let message = `Error parsing text "${text}": ` + err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return {
        error: { message },
        json: [],
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

export default ListParser;
