function CodeParser({ __name, __metadata, constants, logger }) {

  async function parse(text) {
    // logger.debug('Parsing:', text);
    try {
      if (text.includes('```')) {
        text = text.split(/```(?:\w+)?/)[1].trim();
      }
    } catch (err) {
      logger.error('Error parsing text:', err);
    }
    // logger.debug('text:', text);
    return { text };
  }

  return {
    __name,
    __metadata,
    parse,
  };

}

export default CodeParser;
