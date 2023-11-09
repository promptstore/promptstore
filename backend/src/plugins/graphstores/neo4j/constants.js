export default {
  NEO4J_HOST: process.env.NEO4J_HOST,
  NEO4J_PORT: process.env.NEO4J_PORT,
  NEO4J_USERNAME: process.env.NEO4J_USERNAME,
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
  NEO4J_DATABASE: process.env.NEO4J_DATABASE || 'neo4j',
}