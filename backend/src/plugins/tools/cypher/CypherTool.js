import neo4j from 'neo4j-driver';

function CypherTool({ __key, __name, constants, logger }) {

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

  async function call({ input }) {
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