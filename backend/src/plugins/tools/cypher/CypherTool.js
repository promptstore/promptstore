import neo4j from 'neo4j-driver';

const relsQuery = `
  CALL apoc.meta.data()
  YIELD label, other, elementType, type, property
  WHERE type = "RELATIONSHIP" AND elementType = "node"
  UNWIND other AS other_node
  RETURN {start: label, type: property, end: toString(other_node)} AS output
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

  async function call({ input }) {
    const session = getClient().session();
    try {
      const { response, errors } = await executionsService.executeFunction('generate_cypher', { content: input });
      if (errors) {
        logger.error(errors);
        return "I don't know how to answer that";
      }
      const query = response.choices[0].message.content;
      const relationships = await getRelationships();
      const schemas = relationships.map(rel => [rel.start, rel.type, rel.end]);
      const queryCorrector = createCypherQueryCorrector(schemas);
      const correctedQuery = queryCorrector.call(query);
      const r = await session.run(correctedQuery);
      const records = r.records;
      logger.debug('records:', records);
      return records;
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      await session.close();
    }
  }

  function getOpenAIMetadata() {
    return {
      name: __key,
      description: constants.CYPHER_DESCRIPTION,
      parameters: {
        properties: {
          input: {
            description: 'Input text',
            type: 'string',
          },
        },
        required: ['input'],
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