export default {
  CYPHER_DESCRIPTION: 'A query tool to find answers from a knowledge graph. If using the tool, provide the original user question as input.',
  NEO4J_HOST: process.env.NEO4J_HOST,
  NEO4J_PORT: process.env.NEO4J_PORT,
  NEO4J_USERNAME: process.env.NEO4J_USERNAME,
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
  NEO4J_DATABASE: process.env.NEO4J_DATABASE || 'neo4j',
}