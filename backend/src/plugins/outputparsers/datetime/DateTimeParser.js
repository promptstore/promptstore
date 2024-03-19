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
        error: { message: 'Nothing to parse' },
        nonJsonStr: text,
      };
    }
    try {
      const parsed = chrono.parseDate(text);
      return { json: parsed };

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

export default DateTimeParser;
