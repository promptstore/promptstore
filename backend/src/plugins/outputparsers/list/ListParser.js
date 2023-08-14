function ListParser({ __name, __metadata, constants, logger, app, auth }) {

  async function parse(text) {
    // logger.debug('Parsing:', text);
    let line = text.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .pop();
    let list = line.replace(/"/g, '').split(/\s*,\s*/).map(item => item);

    // logger.debug('Formatted:', list);
    return list;
  }

  return {
    __name,
    __metadata,
    parse,
  };

}

export default ListParser;
