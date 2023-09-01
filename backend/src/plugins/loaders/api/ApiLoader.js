import axios from 'axios';

function ApiLoader({ __name, constants, logger }) {

  async function load({
    endpoint,
    nodeType,
    schema,
  }) {
    const res = await axios.get(endpoint);
    let chunks;
    if (schema.type === 'array') {
      chunks = res.data.map((val) => {
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
      chunks = [{ ...doc, nodeType }];
    } else {
      chunks = [{ text: res.data, nodeType }];
    }
    return { chunks };
  }

  return {
    __name,
    load,
  };
}

export default ApiLoader;
