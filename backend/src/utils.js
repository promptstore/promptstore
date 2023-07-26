const Handlebars = require('handlebars');
const axios = require('axios');
const fs = require('fs');
const isObject = require('lodash.isobject');
const path = require('path');
const winston = require('winston');

const logger = new winston.Logger({
  transports: [new winston.transports.Console()],
  level: process.env.ENV?.toLowerCase() === 'dev' ? 'debug' : 'info',
});

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

const delay = (t) => {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  })
};

const downloadImage = async (url, filepath) => {
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
const hashStr = (str) => {
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

const installModules = (dir, options) => {
  const root = path.join(__dirname, dir);
  const files = fs.readdirSync(root);
  const ret = {};
  for (const file of files) {
    const { name, ext } = path.parse(file);
    // skip non-js files
    if (ext !== '.js') continue;
    const mod = require(path.join(root, file));
    if (typeof mod === 'function') {
      ret[name] = mod(options);
    }
  }
  return ret;
};

const sentenceEndings = ['!', '?', '.'];

const hasSentenceEnding = (content) => {
  if (!content) {
    return false;
  }
  return sentenceEndings.some((e) => content.endsWith(e));
};

const appendSentence = (content, sentence) => {
  content = content.trim();
  const sep = hasSentenceEnding(content) ? ' ' : '. ';
  return content + sep + sentence;
};

const list = (arr) => {
  if (Array.isArray(arr)) {
    return arr.map((x) => String(x)).join(', ');
  }
  return String(arr);
};

const replaceUndefinedAndNullValues = (obj, replacementValue) => {
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

const fillTemplate = (templateString, templateVars, engine = 'es6') => {
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

const getExtension = (filepath) => {
  if (!filepath) return null;
  const index = filepath.lastIndexOf('.');
  return filepath.slice(index + 1);
}

const getMessages = (prompts, features, engine) => prompts.map((p, i) => ({
  role: p.role || (i < prompts.length - 1 ? 'system' : 'user'),
  content: fillTemplate(isObject(p) ? p.prompt : p, features, engine),
}));

const getPlugins = (basePath, config, logger, options) => {
  return config.split(',').reduce((a, p) => {
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
    const resolvedPath = require.resolve(path, { paths: [basePath] });
    logger.log('debug', 'requiring: %s', resolvedPath);
    const { constants, plugin } = require(resolvedPath);
    logger.log('debug', 'constants: %s', constants);
    logger.log('debug', 'plugin: %s - %s', name, typeof plugin);
    a[key] = plugin({
      __key: key,
      __name: name,
      __metadata,
      constants,
      logger,
      ...options,
    });
    return a;
  }, {});
};

const isNumber = (str) => {
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
};

const makePromiseFromObject = (obj) => {
  const keys = Object.keys(obj);
  const values = Object.values(obj);
  logger.debug('obj:', keys, values);
  return Promise.all(values)
    .then((resolved) => resolved.reduce((a, v, i) => {
      a[keys[i]] = v;
      return a;
    }, {}));
}

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  appendSentence,
  delay,
  downloadImage,
  fillTemplate,
  getExtension,
  getMessages,
  getPlugins,
  hashStr,
  installModules,
  makePromiseFromObject,
  sleep,
};