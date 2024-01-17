function NumberedListParser({ __name, __metadata, constants, logger, app, auth }) {

  async function parse(text) {
    logger.debug('parsing:', text);
    if (!text) {
      return {
        error: 'Nothing to parse',
        json: text,
      };
    }
    try {
      let list = text.split(/\n\s*\d+\.\s*/).slice(1);
      const n = list.length - 1;
      const last = list[n];
      const i = last.indexOf('\n');
      if (i !== -1) {
        list = [...list.slice(0, n), last.slice(0, i)];
      }
      return { json: list };

    } catch (err) {
      logger.error('Error parsing text:', err);
      return { json: [text] };
    }
  }

  return {
    __name,
    __metadata,
    parse,
  };

}

export default NumberedListParser;
