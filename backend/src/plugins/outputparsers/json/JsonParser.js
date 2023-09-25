import trimEnd from 'lodash.trimend';

function JsonParser({ __name, __metadata, constants, logger, app, auth }) {

  async function parse(text) {
    // logger.debug('Parsing:', text);
    try {
      if (text.includes('```')) {
        text = text.split(/```(?:json)?/)[1].trim();
      }
    } catch (err) {
      // keep trying
    }
    // if (isTruncated(text)) {
    const { jsonStr, fixed } = fixTruncatedJson(text);
    // if (fixed) {
    try {
      return JSON.parse(jsonStr);
    } catch (err) {
      return {
        error: String(err),
        jsonStr,
      };
    }
    // }
    // return {
    //   error: 'Invalid JSON',
    //   jsonStr,
    // };
    // }
    try {
      return JSON.parse(text);
    } catch (err) {
      return {
        error: String(err),
        jsonStr: text,
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

  // Test if the json string is truncated by checking if the number of opening
  // brackets is greater than the number of closing brackets.
  const isTruncated = (jsonStr) => {
    const { stack } = buildStack(jsonStr);
    return stack.length > 0;
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

  return {
    __name,
    __metadata,
    parse,
  };

}

export default JsonParser;
