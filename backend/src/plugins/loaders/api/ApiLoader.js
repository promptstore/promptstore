import axios from 'axios';
import uuid from 'uuid';

function ApiLoader({ __name, constants, logger }) {

  async function load({
    endpoint,
    schema,
  }) {
    const res = await axios.get(endpoint);
    let documents;
    if (schema.type === 'array') {
      documents = res.data.map((doc) => {
        if (schema.items.type === 'object') {
          const content = Object.keys(schema.items.properties).reduce((a, key) => {
            a[key] = doc[key];
            return a;
          }, {});
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
        const text = JSON.stringify(content);
        const size = new Blob([text]).size;
        return {
          id: uuid.v4(),
          endpoint,
          mimetype: 'application/json',
          size,
          content,
        };
      });
    } else if (schema.type === 'object') {
      const content = Object.keys(schema.properties).reduce((a, key) => {
        a[key] = doc[key];
        return a;
      }, {});
      const text = JSON.stringify(content);
      const size = new Blob([text]).size;
      return [
        {
          id: uuid.v4(),
          endpoint,
          mimetype: 'application/json',
          size,
          content,
        }
      ];
    } else {
      const text = JSON.stringify(res.data);
      const size = new Blob([text]).size;
      return [
        {
          id: uuid.v4(),
          endpoint,
          mimetype: 'application/json',
          size,
          content: res.data,
        }
      ];
    }
  }

  return {
    __name,
    load,
  };
}

export default ApiLoader;
