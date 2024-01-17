function CodeParser({ __name, __metadata, constants, logger }) {

  async function parse(text) {
    logger.debug('parsing:', text);
    if (!text) {
      return {
        error: 'Nothing to parse',
        json: text,
      };
    }
    try {
      if (text.includes('```')) {
        text = text.split(/```(?:\w+)?/)[1].trim();
      }
    } catch (err) {
      logger.error('Error parsing text:', err);
      return {
        error: String(err),
        json: text,
      };
    }
    return { json: text };
  }

  return {
    __name,
    __metadata,
    parse,
  };

}

export default CodeParser;
