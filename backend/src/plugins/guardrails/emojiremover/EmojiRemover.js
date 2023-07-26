function EmojiRemover({ __name, __metadata, constants, logger, app, auth }) {

  async function scan(text) {
    // logger.debug('Removing emojis from:', text);
    text = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2580-\u27BF]|\uD83E[\uDD10-\uDDFF]/g, '');
    // logger.debug('Cleaned:', text);
    return {
      text,
    };
  }

  return {
    __name,
    __metadata,
    scan,
  };

}

module.exports = EmojiRemover;
