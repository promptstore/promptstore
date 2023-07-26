const chrono = require('chrono-node');

function DateTimeParser({ __name, __metadata, constants, logger, app, auth }) {

  /**
   * 
   * See https://github.com/wanasit/chrono
   * 
   * @param {*} text 
   * @returns 
   */
  async function parse(text) {
    // logger.debug('Parsing:', text);
    let datetime = chrono.parseDate(text);

    // logger.debug('Formatted:', datetime);
    return datetime;
  }

  return {
    __name,
    __metadata,
    parse,
  };

}

module.exports = DateTimeParser;
