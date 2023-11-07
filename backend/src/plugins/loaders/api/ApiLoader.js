import axios from 'axios';
import uuid from 'uuid';

function ApiLoader({ __name, constants, logger }) {

  async function load({
    endpoint,
    schema,
  }) {
    try {
      const res = await axios.get(endpoint);
      if (schema.type === 'array') {
        const getDoc = (d) => getDocument(endpoint, schema.items, d);
        return res.data.map(getDoc);
      }
      return getDocument(endpoint, schema, res.data);
    } catch (err) {
      logger.error(err, err.stack);
      return [];
    }
  }

  function getContent(schema, data) {
    if (schema.type === 'array') {
      return data.map(d => getContent(schema.items, d));
    }
    if (schema.type === 'object') {
      return Object.keys(schema.properties).reduce((a, key) => {
        a[key] = getContent(schema.properties[key], data[key]);
        return a;
      }, {});
    }
    return data;
  }

  function getDocument(endpoint, schema, data) {
    const content = getContent(schema, data);
    const text = JSON.stringify(content);
    const size = new Blob([text]).size;
    return {
      id: uuid.v4(),
      endpoint,
      mimetype: 'application/json',
      size,
      content,
    };
  }

  return {
    __name,
    load,
  };
}

export default ApiLoader;
