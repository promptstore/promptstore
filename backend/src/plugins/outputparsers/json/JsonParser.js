import trimEnd from 'lodash.trimend';

function JsonParser({ __name, __metadata, constants, logger, app, auth }) {

  async function parse(text) {
    logger.debug('parsing:', text);
    if (!text) {
      return {
        error: 'Nothing to parse',
        json: text,  // TODO remove
        nonJsonStr: text,
      };
    }
    let maybeJsonStr = text;
    let nonJsonStr;
    if (maybeJsonStr.includes('```')) {
      try {
        // text = text.split(/```(?:json)?/)[1].trim();
        const RE = /(```(json)?)([\s\S]*?)(```)/;
        const match = RE.exec(maybeJsonStr);
        if (match) {
          maybeJsonStr = match[3].trim();
          const i = match.index;
          const j = i + match[0].length;
          nonJsonStr = text.slice(0, i) + ' ' + text.slice(j);
        }
      } catch (err) {
        // keep trying
      }
    }
    // logger.debug('text:', text);
    try {
      const { jsonStr, fixed } = fixTruncatedJson(maybeJsonStr);
      // logger.debug('json string:', jsonStr);
      const json = JSON.parse(jsonStr);
      return { fixed, json, nonJsonStr };
    } catch (err) {
      logger.error('Error parsing text:', err);
      return {
        error: String(err),
        json: text,  // TODO remove
        nonJsonStr: text,
      };
    }
  }

  /**
   * Exclude extraneous chars outside of json blob starting with '{' or '['
   * 
   * @param {*} jsonStr 
   * @returns 
   */
  const buildStack = (jsonStr) => {
    const stack = [];
    let fixedStr = '';
    let openQuotes = false;
    let inJson = false;

    for (let i = 0; i < jsonStr.length; i++) {
      let char = jsonStr.charAt(i);
      if (!openQuotes) {
        if (char === '{' || char === '[') {
          inJson = true;
          // opening a new nested
          stack.push(char);
        } else if (char === '}' || char === ']') {
          // closing a nested
          stack.pop();
          if (inJson && !stack.length) {
            fixedStr += char;
            break;  // get first json blob only
          }
        }
      }
      if (char === '"' && i > 0 && jsonStr.charAt(i - 1) == '\\') {
        // opening or closing a string, only if it's not escaped
        openQuotes = !openQuotes;
      }
      if (inJson) {
        fixedStr += char;
      }
    }
    return { stack, fixedStr, openQuotes };
  };

  // Simple json parser that attempts to fix truncated json that might
  // be caused by the API response being too long.
  const fixTruncatedJson = (jsonStr) => {
    let { stack, fixedStr, openQuotes } = buildStack(jsonStr);
    const isTruncated = stack.length > 0;
    if (!isTruncated) {
      return { jsonStr: fixedStr, fixed: false };
    }
    fixedStr = fixedStr.trim();
    if (openQuotes) {
      fixedStr += '"';
    }
    // Ensure we don't have trailing commas
    fixedStr = trimEnd(fixedStr, ',');

    // If we still have nested items remaining in our stack,
    // unwind it into the fixed string

    // Unwind the stack by filling it with the closing character
    // of the current nested level
    const closeStack = stack.map((char) => char === '[' ? ']' : '}');
    fixedStr += closeStack.reverse().join('');

    return { fixedStr, fixed: true };
  };

  // Test if the json string is truncated by checking if the number of opening
  // brackets is greater than the number of closing brackets.
  const isTruncated = (jsonStr) => {
    const { stack } = buildStack(jsonStr);
    return stack.length > 0;
  };

  return {
    __name,
    __metadata,
    parse,
  };

}

export default JsonParser;
