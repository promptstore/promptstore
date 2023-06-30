const isObject = require('lodash.isobject');

const delay = (t) => {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  })
};

const getMessages = (prompts, features, engine) => prompts.map((p, i) => ({
  role: p.role || (i < prompts.length - 1 ? 'system' : 'user'),
  content: fillTemplate(isObject(p) ? p.prompt : p, features, engine),
}));

module.exports = {
  delay,
  getMessages,
};