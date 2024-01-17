import * as chrono from 'chrono-node';

function DateTimeParser({ __name, __metadata, constants, logger, app, auth }) {

  /**
   * 
   * See https://github.com/wanasit/chrono
   * 
   * @param {*} text 
   * @returns 
   */
  async function parse(text) {
    logger.debug('parsing:', text);
    if (!text) {
      return {
        error: 'Nothing to parse',
        json: text,
      };
    }
    try {
      text = chrono.parseDate(text);
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

export default DateTimeParser;
