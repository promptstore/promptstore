import neo4j from 'neo4j-driver';

import { getInputString } from '../../../core/utils';
import { createCypherQueryCorrector } from './CypherQueryCorrector';

const nodesQuery = `
  CALL apoc.meta.data()
  YIELD label, other, elementType, type, property
  WHERE NOT type = "RELATIONSHIP" AND elementType = "node"
  WITH label AS nodeLabels
  RETURN distinct nodeLabels AS output
`;

const relsQuery = `
  CALL apoc.meta.data()
  YIELD label, other, elementType, type, property
  WHERE type = "RELATIONSHIP" AND elementType = "node"
  UNWIND other AS other_node
  RETURN {start: label, type: property, end: toString(other_node)} AS output
`;

const entitiesQuery = `
  MATCH (n) WHERE labels(n)[0] IN $entityTypes
  RETURN DISTINCT labels(n)[0] AS type, n.name AS name
`;

function CypherTool({ __key, __name, constants, logger, services }) {

  const { executionsService } = services;

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

  async function getNodes() {
    const session = getClient().session();
    try {
      const res = await session.run(nodesQuery);
      return res.records.map(r => r.get('output'));
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      await session.close();
    }
  }

  async function getRelationships() {
    const session = getClient().session();
    try {
      const res = await session.run(relsQuery);
      return res.records.map(r => r.get('output'));
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      await session.close();
    }
  }

  async function getAllowedEntities(entityTypes) {
    const session = getClient().session();
    try {
      const res = await session.run(entitiesQuery, { entityTypes });
      const map = res.records.reduce((a, r) => {
        const type = r.get('type');
        const name = r.get('name');
        if (!a[type]) {
          a[type] = [];
        }
        a[type].push(name);
        return a;
      }, {});
      return Object.entries(map).map(([type, values]) => ({ type, values }));
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      await session.close();
    }
  }

  async function call(args, raw) {
    const session = getClient().session();
    try {
      const entityTypes = await getNodes();
      const relationships = await getRelationships();
      const schemas = relationships.map(rel => [rel.start, rel.type, rel.end]);
      const relTypes = schemas.map(rel => rel.join(' '));
      const content = getInputString(args);
      let res;
      res = await executionsService.executeFunction({
        semanticFunctionName: 'extract_entities',
        args: { content, entityTypes, relTypes },
        workspaceId: 2,
      });
      if (res.errors) {
        logger.error(res.errors);
        return "I don't know how to answer that";
      }
      const message = res.response.choices[0].message;
      let json;
      try {
        if (message.function_call) {
          json = JSON.parse(message.function_call.arguments);
        } else {
          json = JSON.parse(message.content);
        }
      } catch (err) {
        logger.error(err);
        json = {};
      }
      const entities = json.entities.map(e => e.entity);
      const types = json.entities.map(e => e.type);
      const allowedEntities = await getAllowedEntities(types);
      res = await executionsService.executeFunction({
        semanticFunctionName: 'resolve_entities',
        args: {
          ...args,
          allowedEntities,
          entities,
        },
        workspaceId: 2,
      });
      res = await executionsService.executeFunction({
        semanticFunctionName: 'generate_cypher',
        args: { content: res.response.choices[0].message.content },
        workspaceId: 2,
      });
      if (res.errors) {
        logger.error(res.errors);
        return "I don't know how to answer that";
      }
      const query = res.response.choices[0].message.content;
      const queryCorrector = createCypherQueryCorrector(schemas);
      const correctedQuery = queryCorrector.call(query);
      const r = await session.run(correctedQuery);
      const recs = r.records.map(r => r.keys.reduce((a, k) => {
        a[k] = r.get(k);
        return a;
      }, {}));
      if (raw) {
        return recs;
      }
      return getResultAsText(recs, content);
    } catch (err) {
      logger.error(err, err.stack);
      return raw ? [] : "I don't know how to answer that";
    } finally {
      await session.close();
    }
  }

  function getResultAsText(recs, content) {
    if (recs.length) {
      let inline = true;
      let maxWords = 0;
      const texts = [];
      for (const rec of recs) {
        let text;
        if (rec.output) {
          text = String(rec.output);
          const numWords = text.split(/\s+/).length;
          maxWords = Math.max(maxWords, numWords);
        } else {
          inline = false;
          text = Object.entries(rec)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join('\n  ');
        }
        texts.push(text);
      }
      const prefix = `The answer to the question "${content}" is:`;
      if (inline && maxWords < 6) {
        return prefix + ' ' + texts.join(', ');
      }
      return prefix + '\n- ' + texts.join('\n- ');
    }
    return "I don't know how to answer that";
  }

  function getOpenAIMetadata() {
    return {
      name: __key,
      description: constants.CYPHER_DESCRIPTION,
      parameters: {
        properties: {
          content: {
            description: 'Input text',
            type: 'string',
          },
        },
        required: ['content'],
        type: 'object',
      },
    };
  }

  return {
    __name,
    __description: constants.CYPHER_DESCRIPTION,
    call,
    getOpenAIMetadata,
  };
}

export default CypherTool;