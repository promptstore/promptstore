import Handlebars from 'handlebars';
import StackTrace from 'stacktrace-js/stacktrace.js';
import axios from 'axios';
import fs from 'fs';
import isObject from 'lodash.isobject';
import path from 'path';
import { fileURLToPath } from 'url';

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
}

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
  const a = {};
  for (const p of config.split(',')) {
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
    logger.log('debug', 'requiring:', resolvedPath);
    const { constants, plugin } = await import(resolvedPath);
    logger.log('debug', 'constants:', constants);
    logger.log('debug', 'plugin: %s - %s', name, typeof plugin);
    a[key] = plugin({
      __key: key,
      __name: name,
      __metadata,
      constants,
      logger,
      ...options,
    });
  }
  return a;
};

export const isNumber = (str) => {
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
};

export const makePromiseFromObject = (obj) => {
  const keys = Object.keys(obj);
  const values = Object.values(obj);
  logger.debug('obj:', keys, values);
  return Promise.all(values)
    .then((resolved) => resolved.reduce((a, v, i) => {
      a[keys[i]] = v;
      return a;
    }, {}));
}

export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}
