function NumberedListParser({ __name, __metadata, constants, logger, app, auth }) {

  async function parse(text) {
    // logger.debug('Parsing:', text);
    let list = text.split(/\n\s*\d+\.\s*/).slice(1);
    const n = list.length - 1;
    const last = list[n];
    const i = last.indexOf('\n');
    if (i !== -1) {
      list = [...list.slice(0, n), last.slice(0, i)];
    }

    // logger.debug('Formatted:', list);
    return list;
  }

  return {
    __name,
    __metadata,
    parse,
  };

}

module.exports = NumberedListParser;
