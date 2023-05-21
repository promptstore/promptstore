const trimEnd = require('lodash.trimend');

const buildStack = (jsonStr) => {
  const stack = [];
  let fixedStr = '';
  let openQuotes = false;

  for (let i = 0; i < jsonStr.length; i++) {
    let char = jsonStr.charAt(i);
    if (!openQuotes) {
      if (char === '{' || char === '[') {
        // opening a new nested
        stack.push(char);
      } else if (char === '}' || char === ']') {
        // closing a nested
        stack.pop();
      }
    }
    if (char === '"' && i > 0 && jsonStr.charAt(i - 1) == '\\') {
      // opening or closing a string, only if it's not escaped
      openQuotes = !openQuotes;
    }
    fixedStr += char;
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
    return { jsonStr, fixed: false };
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

const convertToArray = (str) => {
  if (str) {
    return str.replace(/"/g, '').split(',').map((w) => w.trim());
  }
  return null;
};

module.exports = {
  isTruncated,
  fixTruncatedJson,
  fixBools,
  convertToArray,
};