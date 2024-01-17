function ListParser({ __name, __metadata, constants, logger, app, auth }) {

  async function parse(text) {
    logger.debug('parsing:', text);
    if (!text) {
      return {
        error: 'Nothing to parse',
        json: text,
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
      logger.error('Error parsing text:', err);
      return {
        error: String(err),
        json: text,
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
