const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

const fillTemplate = (templateString, templateVars) => {
  if (!templateString) {
    return null;
  }
  if (!templateVars) {
    return templateString;
  }
  templateVars = { list, ...templateVars };

  try {
    templateString = templateString.replace(/\`/g, '\\`');
    const func = new Function(...Object.keys(templateVars), "return `" + templateString + "`;");
    return func(...Object.values(templateVars));
  } catch (err) {
    console.error(err);
    return null;
  }
};

module.exports = {
  appendSentence,
  delay,
  downloadImage,
  fillTemplate,
  hashStr,
  installRoutesDir,
};