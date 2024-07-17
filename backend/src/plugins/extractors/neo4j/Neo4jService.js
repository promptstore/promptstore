import neo4j from 'neo4j-driver';
import isEmpty from 'lodash.isempty';

function Neo4jService({ __name, constants, logger }) {

  let _client;

  function getClient() {
    if (!_client) {
      _client = neo4j.driver(
        `neo4j://${constants.NEO4J_HOST}:${constants.NEO4J_PORT}`,
        neo4j.auth.basic(constants.NEO4J_USERNAME, constants.NEO4J_PASSWORD),
        {
          forceJSNumbers: true,
          logging: neo4j.logging.console('debug'),
          disableLosslessIntegers: true,
        }
      );
    }
    return _client;
  }

  async function getChunks(documents, params) {
    const {
      nodeLabel,
      sourceIndexName,
      embeddingNodeProperty,
      textNodeProperties,
      limit = 10000,
    } = params;
    const label = nodeLabel ? `\`${nodeLabel}\`` : '';
    let indexNameCondition = '';
    if (sourceIndexName) {
      indexNameCondition = `WHERE n.indexName = $indexName`;
    }
    let noEmbeddingCondition = '';
    if (embeddingNodeProperty) {
      noEmbeddingCondition = `AND n.${embeddingNodeProperty} IS null`;
    }
    const q = `
      MATCH (n:${label})
      ${indexNameCondition}
      OPTIONAL MATCH (n:${label})-[r]-(c)
      WHERE startNode(r) = n
      ${noEmbeddingCondition}
      RETURN 
        elementId(n) AS node_id,
        labels(n)[0] AS node_type, 
        properties(n) AS node_props, 
        type(r) AS rel_type, 
        elementId(c) AS connected_id,
        labels(c)[0] AS connected_type, 
        properties(c) AS connected_props
      LIMIT toInteger($limit)
    `;
    const session = getClient().session();
    try {
      const result = await session.run(q, {
        indexName: sourceIndexName,
        limit,
      });
      const nodeMap = result.records.reduce((a, r) => {
        const id = r.get('node_id');
        if (!a[id]) {
          const nodeLabel = r.get('node_type');
          const nodeProps = r.get('node_props');
          const createdDatetime = new Date().toISOString();
          a[id] = {
            id,
            nodeLabel,
            documentId: null,
            type: 'node',
            data: nodeProps,
            createdDatetime,
            createdBy: constants.NEO4J_DATABASE,
            startDatetime: createdDatetime,
            endDatetime: null,
            version: 1,
            name: nodeProps.name || nodeLabel,
          };
        }
        const relType = r.get('rel_type');
        const connectedId = r.get('connected_id');
        const connectedType = r.get('connected_type');
        const connectedProps = r.get('connected_props');
        const relProp = `${relType}_${connectedType}`;
        a[id].data[relProp] = {
          id: connectedId,
          nodeLabel: connectedType,
          ...connectedProps,
        };
        return a;
      }, {});
      const schema = await getSchema({ nodeLabel });
      const nodeMapWithText = Object.entries(nodeMap)
        .reduce((a, [k, v]) => {
          if (v.nodeLabel === nodeLabel) {
            const texts = getTexts(v, schema, true, textNodeProperties);
            let text = v.nodeLabel;
            if (texts.length) {
              text += `:\n${texts.join('\n')}`;
            }
            a[k] = {
              ...v,
              text,
            };
          } else {
            a[k] = v;
          }
          return a;
        }, {});

      return Object.values(nodeMapWithText);

    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      throw err;
    } finally {
      await session.close();
    }
  }

  async function getSchema(params) {
    const {
      nodeLabel,
    } = params;
    const q = `CALL db.schema.nodeTypeProperties`;
    const session = getClient().session();
    try {
      const result = await session.run(q);
      const rels = await getRelationships(session);
      const nodes = {};
      const required = {};
      for (const rec of result.records) {
        const nodeType = rec._fields[1][0];
        const property = rec._fields[2];
        const dataType = rec._fields[3][0];
        const mandatory = rec._fields[4];
        if (!nodes[nodeType]) {
          nodes[nodeType] = {};
        }
        nodes[nodeType][property] = {
          type: getJsonSchemaType(dataType),
        };
        if (mandatory) {
          if (!required[nodeType]) {
            required[nodeType] = [];
          }
          required[nodeType].push(property);
        }
      }
      for (const nodeType of Object.keys(nodes)) {
        const rs = rels[nodeType];
        if (rs) {
          for (const r of rs) {
            const property = `${r.name}_${r.to}`;
            nodes[nodeType][property] = {
              '$ref': `#/definitions/${r.to}`,
            };
          }
        }
      }
      const definitions = Object.entries(nodes).reduce((a, [k, v]) => {
        if (k !== nodeLabel) {
          a[k] = {
            type: 'object',
            properties: v,
            required: required[k],
          };
        }
        return a;
      }, {});
      return {
        definitions,
        type: 'object',
        properties: nodes[nodeLabel],
        required: required[nodeLabel],
      };
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      throw err;
    } finally {
      await session.close();
    }
  }

  function matchDocument(doc) {
    return true;
  }

  function getJsonSchemaType(cypherType) {
    switch (cypherType) {
      case 'String':
      case 'Date':
      case 'DateTime':
      case 'Zoned DateTime':
      case 'Zoned Time':
        return 'string';

      case 'Boolean':
        return 'boolean';

      case 'Float':
      case 'Integer':
        return 'number';


      default:
        return 'string';
    }
  }

  async function getRelationships(session) {
    const q = `CALL db.schema.visualization`;
    session = session || getClient().session();
    try {
      const result = await session.run(q);
      const nodes = result.records[0].get('nodes').reduce((a, n) => {
        a[n.elementId] = n.labels[0];
        return a;
      }, {});
      return result.records[0].get('relationships')
        .map(r => ({
          name: r.type,
          from: nodes[r.startNodeElementId],
          to: nodes[r.endNodeElementId],
        }))
        .reduce((a, r) => {
          if (!a[r.from]) {
            a[r.from] = [];
          }
          a[r.from].push(r);
          return a;
        }, {})
        ;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      throw err;
    } finally {
      await session.close();
    }
  }

  function getTexts(node, schema, getRels, textNodeProperties) {
    const { data } = node;
    return Object.entries(schema.properties)
      .filter(([k, v]) => {
        return (
          (v.type === 'string' || (getRels && (v.type === 'object' || v.$ref))) &&
          data[k] &&
          (v.type === 'object' || v.$ref || isEmpty(textNodeProperties) || textNodeProperties.includes(k))
        );
      })
      .map(([k, v]) => {
        const name = k.replace(/[-_]/g, ' ');
        if (v.type === 'string') {
          return `${name}: ${data[k]}`;
        }
        let texts = [];
        if (v.$ref) {
          const nodeLabel = v.$ref.split('/').pop();
          texts = getTexts({ data: data[k] }, schema.definitions[nodeLabel], false, textNodeProperties);
        } else if (v.type === 'object') {
          texts = getTexts({ data: data[k] }, v.properties, false, textNodeProperties);
        }
        let text = name;
        if (texts.length) {
          text += `: [${texts.join('; ')}]`;
        }
        return text;
      });
  }

  return {
    __name,
    getChunks,
    getSchema,
    matchDocument,
  };

}

export default Neo4jService;