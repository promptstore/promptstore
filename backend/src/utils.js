const Handlebars = require('handlebars');
const axios = require('axios');
const fs = require('fs');
const isObject = require('lodash.isobject');
const path = require('path');

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

const installRoutesDir = (dir, options, logger) => {
  const routesDir = path.join(__dirname, dir);
  const files = fs.readdirSync(routesDir);
  for (const file of files) {
    // skip non-js files
    if (path.extname(file) !== '.js') continue;
    const routes = require(path.join(routesDir, file));
    if (typeof routes === 'function') {
      routes(options);
    }
  }
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

const fillTemplate = (templateString, templateVars, engine = 'es6') => {
  if (!templateString) {
    return null;
  }
  if (!templateVars) {
    return templateString;
  }

  if (engine === 'handlebars') {
    const template = Handlebars.compile(templateString);
    return template(templateVars);

  } else {  // `engine === 'es6'`
    templateVars = { list, ...templateVars };

    try {
      templateString = templateString.replace(/\`/g, '\\`');
      const func = new Function(...Object.keys(templateVars), "return `" + templateString + "`;");
      return func(...Object.values(templateVars));
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

module.exports = {
  appendSentence,
  delay,
  downloadImage,
  fillTemplate,
  getExtension,
  getMessages,
  hashStr,
  installRoutesDir,
};