import camelCase from 'lodash.camelcase';
import capitalize from 'lodash.capitalize';
import startCase from 'lodash.startcase';
import neo4j from 'neo4j-driver';

const nodePropertiesQuery = `
  CALL apoc.meta.data()
  YIELD label, other, elementType, type, property
  WHERE NOT type = "RELATIONSHIP" AND elementType = "node"
  WITH label AS nodeLabels, collect({property:property, type:type}) AS properties
  RETURN {labels: nodeLabels, properties: properties} AS output
`;

const relPropertiesQuery = `
  CALL apoc.meta.data()
  YIELD label, other, elementType, type, property
  WHERE NOT type = "RELATIONSHIP" AND elementType = "relationship"
  WITH label AS nodeLabels, collect({property:property, type:type}) AS properties
  RETURN {type: nodeLabels, properties: properties} AS output
`;

const relsQuery = `
  CALL apoc.meta.data()
  YIELD label, other, elementType, type, property
  WHERE type = "RELATIONSHIP" AND elementType = "node"
  UNWIND other AS other_node
  RETURN {start: label, type: property, end: toString(other_node)} AS output
`;

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

  async function addGraph(indexName, graph) {
    const g = cleanGraph(indexName, graph);
    const q1 = `
      UNWIND $data AS row
      CALL apoc.merge.node([row.type], {id: row.id}, row.properties, {})
      YIELD node
      RETURN distinct 'done' AS result
    `;
    const q2 = `
      UNWIND $data AS row
      CALL apoc.merge.node([row.source_label], {id: row.source}, {}, {})
      YIELD node AS source
      CALL apoc.merge.node([row.target_label], {id: row.target}, {}, {})
      YIELD node AS target
      CALL apoc.merge.relationship(source, row.type, {}, row.properties, target)
      YIELD rel
      RETURN distinct 'done'
    `;
    const session = getClient().session();
    try {
      await session.run(q1, {
        data: g.nodes,
      });
      await session.run(q2, {
        data: g.relationships.map(rel => ({
          source: rel.source.id,
          source_label: rel.source.type,
          target: rel.target.id,
          target_label: rel.target.type,
          type: rel.type.replace(' ', '_').toUpperCase(),
          properties: rel.properties,
        })),
      });
    } catch (err) {
      logger.error(err, err.stack);
      throw err;
    } finally {
      await session.close();
    }
  }

  function cleanGraph(indexName, graph) {
    const g = JSON.parse(graph);
    return {
      nodes: g.nodes.map(node => cleanNode(indexName, node)),
      relationships: g.rels.map(rel => cleanRel(indexName, rel)),
    };
  }

  function cleanRel(indexName, rel) {
    return {
      source: cleanNode(indexName, rel.source),
      target: cleanNode(indexName, rel.target),
      type: rel.type,
      properties: propsToDict(rel.properties),
    };
  }

  function cleanNode(indexName, node) {
    const name = startCase(node.id);
    return {
      id: name,
      type: capitalize(node.type),
      properties: {
        ...propsToDict(node.properties),
        name,
        indexName,
      },
    };
  }

  function propsToDict(props) {
    if (!props) {
      return null;
    }
    return props.reduce((a, p) => {
      a[camelCase(p.key)] = p.value;
      return a;
    }, {});
  }

  async function dropData(indexName) {
    const q = `
      MATCH (n)
      WHERE n.indexName = '${indexName}'
      CALL {
        WITH n DETACH DELETE n
      } IN TRANSACTIONS OF 10000 ROWS
    `;
    const session = getClient().session();
    try {
      await session.run(q);
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      await session.close();
    }
  }

  async function getSchema() {
    const session = getClient().session();
    try {
      const res1 = await session.run(nodePropertiesQuery);
      const nodeProperties = res1.records.map(r => r.get('output'));
      const res2 = await session.run(relPropertiesQuery);
      const relProperties = res2.records.map(r => r.get('output'));
      const res3 = await session.run(relsQuery);
      const relationships = res3.records.map(r => r.get('output'));
      return {
        node_properties: nodeProperties.reduce((a, n) => {
          a[n.labels] = n.properties;
          return a;
        }, {}),
        relationship_properties: relProperties.reduce((a, r) => {
          a[r.type] = r.properties;
          return a;
        }, {}),
        relationships,
      };
    } catch (err) {
      logger.error(err, err.stack);
      throw err;
    } finally {
      await session.close();
    }
  }

  async function getSchemaX(params) {
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
      logger.error(err, err.stack);
      throw err;
    } finally {
      await session.close();
    }
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
      logger.error(err);
      throw err;
    } finally {
      await session.close();
    }
  }

  return {
    __name,
    addGraph,
    dropData,
    getSchema,
  };
}

export default Neo4jService;
