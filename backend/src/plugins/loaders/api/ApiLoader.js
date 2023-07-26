const axios = require('axios');

function ApiLoader({ __name, constants, logger }) {

  async function load({
    endpoint,
    nodeType,
    schema,
  }) {
    const res = await axios.get(endpoint);
    let docs;
    if (schema.type === 'array') {
      docs = res.data.map((val) => {
        if (schema.items.type === 'object') {
          const doc = Object.keys(schema.items.properties).reduce((a, key) => {
            a[key] = val[key];
            return a;
          }, {});
          return { ...doc, nodeType };
        }
        return { text: val, nodeType: 'content' };
      });
    } else if (schema.type === 'object') {
      const doc = Object.keys(schema.properties).reduce((a, key) => {
        a[key] = res.data[key];
        return a;
      }, {});
      docs = [{ ...doc, nodeType }];
    } else {
      docs = [{ text: res.data, nodeType }];
    }
    return docs;
  }

  return {
    __name,
    load,
  };
}

module.exports = ApiLoader;
