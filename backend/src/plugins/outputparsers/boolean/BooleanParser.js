function BooleanParser({ __name, __metadata, constants, logger, app, auth }) {

  async function parse(text) {
    logger.debug('parsing:', text);
    if (!text) {
      return {
        error: 'Nothing to parse',
        json: text,
      };
    }
    try {
      let { fixedStr, fixed } = fixBools(text);
      // logger.debug('json string:', jsonStr);
      return { json: fixedStr === 'true', fixed };
    } catch (err) {
      logger.error('Error parsing text:', err);
      return {
        error: String(err),
        json: text,
      };
    }
  }

  // The model will relatively commonly return booleans as capitalized values because of the
  // usage of caps in other languages common in the training set (like Python).
  const fixBools = (jsonStr) => {
    let modified = false;
    let openQuotes = false;
    let fixedStr = '';

    let i = 0;
    while (i < jsonStr.length) {
      let char = jsonStr.charAt(i);

      if (char === '"' && i > 0 && jsonStr.charAt(i - 1) !== '\\') {
        // Check if the current character is an opening or closing quote
        openQuotes = !openQuotes;
      }

      // If not inside a string, check for "True" or "False" to replace
      if (!openQuotes) {
        if (jsonStr.substring(i, i + 4) === 'True') {
          fixedStr += 'true';
          modified = true;
          i += 3;  // Skip the remaining characters of "True"
        } else if (jsonStr.substring(i, i + 5) === 'False') {
          fixedStr += 'false';
          modified = true;
          i += 4;  // Skip the remaining characters of "False"
        } else {
          fixedStr += char;
        }
      } else {
        fixedStr += char;
      }
      i += 1;
    }

    return { fixedStr, fixed: modified };
  };

  return {
    __name,
    __metadata,
    parse,
  };

}

export default BooleanParser;
