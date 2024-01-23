import Handlebars from 'handlebars';
import StackTrace from 'stacktrace-js/stacktrace.js';
import axios from 'axios';
import fs from 'fs';
import get from 'lodash.get';
import isObject from 'lodash.isobject';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEncoding } from 'js-tiktoken';
import { unflatten } from 'flat';

import logger from './logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

Handlebars.registerHelper('list', (arr) => {
  if (Array.isArray(arr)) {
    const n = arr.length;
    return arr.reduce((a, x, i) => {
      if (i === n - 1) {
        a += x;
      } else if (i === n - 2) {
        a += x + ', and ';
      } else {
        a += x + ', ';
      }
      return a;
    }, '');
  }
  return arr;
});

Handlebars.registerHelper('ol', (arr) => {
  if (Array.isArray(arr)) {
    const items = arr.map((x, i) => `${i}. ${x}`);
    return items.join('\n');
  }
  return arr;
});

Handlebars.registerHelper('ul', (arr) => {
  if (Array.isArray(arr)) {
    const items = arr.map((x) => `- ${x}`);
    return items.join('\n');
  }
  return arr;
});

Handlebars.registerHelper('ifmultiple', (conditional, options) => {
  if (Array.isArray(conditional) && conditional.length > 1) {
    return options.fn(this);
  }
  return options.inverse(this);
});

Handlebars.registerHelper('jsonTextList', (arr) => {
  if (Array.isArray(arr)) {
    return formatTextAsJson(arr);
  }
  return arr;
});

Handlebars.registerHelper('json', (json) => {
  return JSON.stringify(json, null, 2);
});

export const delay = (t) => {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  })
};

export const downloadImage = async (url, filepath) => {
  const resp = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  return new Promise((resolve, reject) => {
    resp.data.pipe(fs.createWriteStream(filepath))
      .on('error', reject)
      .once('close', () => resolve(filepath));
  });
};

/**
 * Translate `str` into a unique 32 bit integer code.
 * 
 * @param {*} str 
 * @returns hash
 */
export const hashStr = (str) => {
  var hash = 0, i, chr;
  if (str) {
    for (i = 0; i < str.length; i++) {
      chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
  }
  return String(Math.abs(hash));
};

export const installModules = async (dir, options) => {
  const root = path.join(__dirname, dir);
  const files = fs.readdirSync(root);
  const ret = {};
  for (const file of files) {
    const { name, ext } = path.parse(file);
    // skip non-js/ts files
    if (ext !== '.js' && ext !== '.ts') continue;
    try {
      const filepath = path.join(root, file);
      const mod = await import(filepath);
      if (typeof mod.default === 'function') {
        ret[name] = mod.default(options);
      }
    } catch (err) {
      logger.error(err, err.stack);
      throw err;
    }
  }
  return ret;
};

const sentenceEndings = ['!', '?', '.'];

export const hasSentenceEnding = (content) => {
  if (!content) {
    return false;
  }
  return sentenceEndings.some((e) => content.endsWith(e));
};

export const appendSentence = (content, sentence) => {
  content = content.trim();
  const sep = hasSentenceEnding(content) ? ' ' : '. ';
  return content + sep + sentence;
};

export const list = (arr) => {
  if (Array.isArray(arr)) {
    return arr.map((x) => String(x)).join(', ');
  }
  return String(arr);
};

export const replaceUndefinedAndNullValues = (obj, replacementValue) => {
  const inner = (value) => {
    if (Array.isArray(value)) {
      return value.map(inner);
    }
    if (isObject(value)) {
      return Object.entries(value).reduce((a, [k, v]) => {
        a[k] = inner(v);
        return a;
      }, {});
    }
    if (value === null || typeof value === 'undefined') {
      return replacementValue;
    }
    return value;
  };

  return inner(obj);
};

export const fillTemplate = (templateString, templateVars, engine = 'es6') => {
  if (!templateString) {
    return null;
  }
  if (!templateVars) {
    return templateString;
  }

  // logger.debug('templateVars:', templateVars);
  templateVars = replaceUndefinedAndNullValues(templateVars, '');
  // logger.debug('templateVars:', templateVars);

  if (engine === 'handlebars') {
    const template = Handlebars.compile(templateString);
    return template(templateVars);

  } else {  // `engine === 'es6'`
    templateVars = { list, ...templateVars };

    try {
      templateString = templateString.replace(/\`/g, '\\`');
      // logger.debug('templateString:', templateString);
      const func = new Function(...Object.keys(templateVars), "return `" + templateString + "`;");
      const str = func(...Object.values(templateVars));
      // logger.debug('str:', str);
      return str;
    } catch (err) {
      console.error(err);
      return null;
    }
  }
};

export const getExtension = (filepath) => {
  if (!filepath) return null;
  const index = filepath.lastIndexOf('.');
  return filepath.slice(index + 1);
};

export const getMimetype = (filepath) => {
  const ext = getExtension(filepath);
  switch (ext) {
    case 'png':
      return 'image/png';

    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';

    default:
  }
};

export const getMessages = (prompts, features, engine) =>
  prompts.map((p, i) => ({
    role: p.role || (i < prompts.length - 1 ? 'system' : 'user'),
    content: fillTemplate(isObject(p) ? p.prompt : p, features, engine),
  }));

let numberOfFramesToRemove = 0;

/**
 * @param {String?} path Relative path.
 * @param {Number} [depth=0] Depth in the stacktrace.
 * @returns {string} The absolute url of the current running code.
 */
export function toAbsoluteUrl(path, depth) {
  // default depth
  depth = depth || 0;

  // get stack
  let stack = StackTrace.getSync()
    .filter(entry => entry.fileName !== '[native code]'); // browsers (like safari) may inject native functions entries

  if (!numberOfFramesToRemove) {
    let found;
    do {
      found = (stack[numberOfFramesToRemove].functionName === currentFunction.name);
      numberOfFramesToRemove++;
    } while (numberOfFramesToRemove < stack.length && !found)
  }

  // remove current function & stacktrace depth
  stack = stack.slice(numberOfFramesToRemove);

  // correct depth
  if (depth < 0)
    depth = 0;
  else if (depth > stack.length - 1)
    depth = stack.length - 1;

  // get caller absolute path
  let absolute = stack[depth].fileName;
  // follow given path from caller absolute path
  if (path)
    absolute = new URL(path, absolute).href;
  // return absolute path
  return absolute;
};

const currentFunction = toAbsoluteUrl;

export const getPlugins = async (basePath, config, logger, options) => {
  logger.debug('plugins:', config);
  const a = {};
  if (config) {
    for (const p of config.split(',')) {
      logger.debug('config:', p);
      const [key, name, path, metadata = ''] = p.split('|').map(e => e.trim());
      const __metadata = metadata.split(',').reduce((a, p) => {
        const [k, v] = p.split('=').map(x => x.trim());
        if (typeof v === 'undefined') {
          a[k] = true;
        } else if (isNumber(v)) {
          a[k] = +v;
        } else {
          a[k] = v;
        }
        return a;
      }, {});
      const resolvedPath = toAbsoluteUrl(path);
      logger.debug('requiring:', resolvedPath);
      const { constants, plugin } = await import(resolvedPath);
      logger.debug('constants:', constants);
      logger.debug('plugin: %s - %s', name, typeof plugin);
      a[key] = plugin({
        __key: key,
        __name: name,
        __metadata,
        constants,
        logger,
        ...options,
      });
    }
  }
  return a;
};

export const isNumber = (str) => {
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
};

const truthyValues = ['true', 't', '1', 'y', 'yes'];

export const isTruthy = (str) => {
  return (str && truthyValues.includes(String(str).trim().toLowerCase()));
}

export const makePromiseFromObject = (obj) => {
  const keys = Object.keys(obj);
  const values = Object.values(obj);
  // logger.debug('obj:', keys, values);
  return Promise.all(values)
    .then((resolved) => resolved.reduce((a, v, i) => {
      a[keys[i]] = v;
      return a;
    }, {}));
}

export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const getFacets = (attributesForFacets, hits) => {
  const facets = attributesForFacets.reduce((a, t) => {
    a[t] = {};
    return a;
  }, {});
  for (const hit of hits) {
    for (const attr of attributesForFacets) {
      const val = get(hit, attr);
      if (val) {
        if (!facets[attr][val]) {
          facets[attr][val] = 0;
        }
        facets[attr][val] += 1;
      }
    }
  }
  return facets;
};

export const formatAlgolia = (requests, hits, nodeLabel, attributesForFacets = []) => {
  // const nbHits = rawResult.length;

  // TODO should be redundant as unflattening moved to plugin
  // but should be idempotent
  // let hits = rawResult.map((val) => Object.entries(val).reduce((a, [k, v]) => {
  //   const key = k.replace(/__/g, '.');
  //   a[key] = v;
  //   return a;
  // }, {}));
  // hits = hits.map(unflatten);
  // -----------

  const nbHits = hits.length;

  hits = hits.map((val) => {
    if (val.dist) {
      return {
        ...val[nodeLabel],
        dist: val.dist,
      };
    } else {
      return {
        ...val[nodeLabel],
        score: parseFloat(val.score),
      };
    }
  });
  const facets = getFacets(attributesForFacets, hits);
  return {
    exhaustive: {
      nbHits: true,
      typo: true,
    },
    exhaustiveNbHits: true,
    exhaustiveType: true,
    hits,
    hitsPerPage: nbHits,
    facets,
    nbHits,
    nbPages: 1,
    page: 0,
    params: '',
    processingTimeMS: 2,
    processingTimingsMS: {
      afterFetch: {
        format: {
          highlighting: 2,
          total: 2,
        },
        total: 2,
      },
      request: {
        roundTrip: 19,
      },
      total: 2,
    },
    query: requests[0].params.query,
    renderingContent: {},
    serverTimeMS: 3,
  };
};

export const formatAttrs = (nodeLabel, facetFilters = []) => {
  console.log('facet filters:', facetFilters);
  return facetFilters.reduce((a, f) => {
    const [facet, value] = f.split(':');
    a[facet] = value;
    return a;
  }, {});
};

// export const formatAttrs = (nodeLabel, facetFilters = []) => {
//   console.log('facet filters:', facetFilters);
//   return facetFilters.reduce((a, f) => {
//     const [facet, value] = f.split(':');
//     const key = `${nodeLabel}__` + facet.replace('.', '__');
//     a[key] = value;
//     return a;
//   }, {});
// };

/**
 * Formats a list of texts into a single string to be used as a user message.
 * Each text is assigned an ID, starting from 0. The returned JSON format
 * helps the model distinguish between different texts, at the cost of
 * increasing the number of tokens used.
 *
 * The token overhead for a single text that doesn't require escaping characters
 * is 12 tokens. Escaping characters like quotes increases the overhead.
 *
 * The format is a JSON list of dictionaries, where each dictionary has an
 * "id" key and a "text" key. The "id" key is an integer, and the "text" key
 * is a string. This array of maps structure is easiest to parse by GPT models
 * and handles edge cases like newlines in the text.
 *
 * @param {Array<string>} texts A list of texts to format.
 * @returns A formatted string that can be used as a user message.
 */
export const formatTextAsJson = (texts) => {
  const dicts = texts.map((text, i) => ({ id: i, text }));
  return JSON.stringify(dicts);
};

export const formatTextAsProse = (texts) => {
  return texts.join('\n');
};

const DEFAULT_CONTENT_PROPS = ['content', 'text', 'input'];

export const getInput = (args, isBatch, options) => {
  if (typeof args === 'string') {
    return args;
  }
  if (Array.isArray(args) && args.length) {
    if (isBatch) {
      return args.map(a => getInput(a, isBatch, options));
    }
    return getInput(args[0]);
  }
  if (isObject(args)) {
    let contentProp = options?.contentProp;
    if (contentProp) {
      if (contentProp === '__all') {
        return getInput(JSON.stringify(args), isBatch, options);
      }
      return getInput(args[contentProp], isBatch, options);
    }
    contentProp = DEFAULT_CONTENT_PROPS.find(key => args[key]);
    if (contentProp) {
      return getInput(args[contentProp], isBatch, options);
    }
  }
  return null;
};

const truncateTextByTokens = (text, maxTokens, encoding) => {
  const tokens = encoding.encode(text);
  const truncatedTokens = tokens.slice(0, maxTokens);
  return encoding.decode(truncatedTokens);
}

/**
 * Binpacks a list of texts into a list of lists of texts, such that each list of texts
 * has a total number of tokens less than or equal to maxTokensPerBin and each list of texts
 * has a number of texts less than or equal to maxTextsPerBin.
 *
 * The binpacking uses a naive greedy algorithm that maintains the order of the texts.
 *
 * @param {Array<string>} texts List of texts to binpack. Empty texts are accepted, 
 *        counted as 0 tokens each and count against maxTextsPerBin.
 * @param {number} maxTokensPerBin The maximum number of tokens per bin of formatted texts.
 *        Leave some room for relative to the model's context size to account for the tokens in the
 *        system message, function call, and function return.
 * @param {number} maxTextsPerBin The maximum number of texts per list of texts. Defaults to None, which
 *        means that there is no limit on the number of texts per list of texts.
 * @param {Function} formatter A function that takes a list of texts and returns a single
 *        text. Defaults to None, which means that the texts are joined with spaces.
 *        This function is used to include the overhead of the formatter function in
 *        the binpacking. It is not used to format the output. Make sure to use
 *        the same formatter function when formatting the output for the model.
 * @param {string} encodingName The name of the encoding to use. Defaults to "cl100k_base".
 * @param {string} longTextHandling How to handle texts that are longer than max_tokens_per_bin. Defaults
 *        to "error", which means that an error is raised. Can also be set to
 *        "truncate", which means that the text is truncated to max_tokens_per_bin.
 *        It is possible that more tokens are truncated than absolutely necessary
 *        due to overhead of the formatter function caused by escaping characters.
 * @returns A list of lists of texts. The order of the texts is preserved.
 */
export const binPackTextsInOrder = (texts, maxTokensPerBin, maxTextsPerBin, formatter, encodingName, longTextHandling) => {
  if (!Array.isArray(texts)) {
    throw new Error('texts must be a list.');
  }
  if (!formatter) {
    formatter = formatTextAsJson;
  }
  if (!maxTextsPerBin) {
    maxTextsPerBin = texts.length;
  }
  if (!encodingName) {
    encodingName = 'cl100k_base';
  }
  if (!longTextHandling) {
    longTextHandling = 'error';
  }
  const encoding = getEncoding(encodingName);
  const bins = [];
  let currentBin = [];
  for (let i = 0; i < texts.length; i++) {
    let text = texts[i];
    if (currentBin.length === maxTextsPerBin) {
      // start a new bin
      bins.push(currentBin);
      currentBin = [];
    }
    // calculate how many tokens would be in the current bin if we added the text
    const binTokensWithNewText = encoding.encode(formatter([...currentBin, text])).length;
    if (binTokensWithNewText > maxTokensPerBin) {
      if (currentBin.length > 0) {
        // start a new bin
        bins.push(currentBin);
        currentBin = [];
      }
      // check if the text fits in a bin by itself
      const tokensTextWithFormatting = encoding.encode(formatter([text])).length;
      if (tokensTextWithFormatting > maxTokensPerBin) {
        // calculate the overhead of the formatter function
        const tokensTextRaw = encoding.encode(text).length;
        const overhead = tokensTextWithFormatting - tokensTextRaw;
        if (overhead > maxTextsPerBin) {
          throw new Error(
            `The formatting function adds ${overhead} overhead tokens, ` +
            `which exceeds the maximum number of tokens (${maxTokensPerBin}) permitted.`
          );
        }
        if (binTokensWithNewText > maxTextsPerBin) {
          // the formatted text is too long to fit in a bin
          if (longTextHandling === 'error') {
            throw new Error(
              `The text at index ${i} has ${tokensTextWithFormatting} tokens, which ` +
              `is greater than the maximum number of tokens (${maxTokensPerBin}). ` +
              `Note that a formatting function added ${overhead} tokens to the text.`
            );
          } else if (longTextHandling === 'truncate') {
            // Truncate the text, accounting for overhead
            // It's possible that more is truncated than necessary
            // in case the overhead was caused by escaping characters
            // in the truncated part of the text
            text = truncateTextByTokens(text, maxTokensPerBin - overhead, encoding);
            // assert(encoding.encode(formatter([text]) <= maxTextsPerBin));
          } else {
            throw new Error(
              `Invalid value for longTextHandling: ${longTextHandling}. ` +
              `Must be one of "error" or "truncate".`
            );
          }
        }
      }
    }
    // add to the current bin
    currentBin.push(text);
  }
  // add to the last bin
  bins.push(currentBin);

  return bins;
}

export function getTextStats(text) {
  if (!text) {
    return { wordCount: 0, length: 0, size: 0 };
  }
  text = text.trim();
  if (!text.length) {
    return { wordCount: 0, length: 0, size: 0 };
  }
  const wordCount = text.split(/\s+/).length;
  const length = text.length;
  const size = new Blob([text]).size;
  return { wordCount, length, size };
}

export const hasValue = (value) => {
  return Object.values(value).some(v => !(v === null || typeof v === 'undefined'));
};