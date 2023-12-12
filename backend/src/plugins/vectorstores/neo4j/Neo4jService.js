import { flatten } from 'flat';
import isObject from 'lodash.isobject';
import neo4j from 'neo4j-driver';

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

  async function getIndexes() {
    const q = `
      SHOW INDEXES YIELD name, type, labelsOrTypes, properties, options
      WHERE type = 'VECTOR' 
      RETURN name, labelsOrTypes, properties, options
    `;
    const session = getClient().session();
    try {
      const r = await session.run(q);
      return r.records;
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      session.close();
    }
  }

  async function getIndex(indexName, params) {
    const {
      nodeLabel,
      embeddingNodeProperty = 'embedding',
    } = params;
    const q = `
      SHOW INDEXES YIELD name, type, labelsOrTypes, properties, options
      WHERE type = 'VECTOR' 
      AND (name = $indexName OR (labelsOrTypes[0] = $nodeLabel AND properties[0] = $embeddingNodeProperty))
      RETURN name, labelsOrTypes, properties, options
      `;
    const session = getClient().session();
    try {
      const r = await session.run(q, {
        indexName,
        nodeLabel,
        embeddingNodeProperty,
      });
      if (!r.records.length) {
        return null;
      }
      const records = r.records.map(r => ({
        name: r.get('name'),
        options: r.get('options'),
      }));
      const indexInfo = records.find(r => r.name === indexName);
      logger.debug('indexInfo:', indexInfo);
      const indexConfig = indexInfo.options.indexConfig;
      const numDocs = await getNumberChunks(indexName, { nodeLabel });
      return {
        indexName,
        nodeLabel,
        numDocs,
        embeddingDimension: indexConfig['vector.dimensions'],
        similarityMetric: indexConfig['vector.similarity_function'],
      };
    } catch (err) {
      logger.error(err, err.stack);
      return null;
    } finally {
      session.close();
    }
  }

  async function createIndex(indexName, schema, params) {
    logger.debug('Creating index:', indexName);
    const {
      nodeLabel,
      embeddingDimension,
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
    } = params;
    const q = `
      CALL db.index.vector.createNodeIndex(
        $indexName,
        $nodeLabel,
        $embeddingNodeProperty,
        toInteger($embeddingDimension),
        $similarityMetric
      )
    `;
    const session = getClient().session();
    try {
      await session.run(q, {
        indexName,
        nodeLabel,
        embeddingNodeProperty,
        embeddingDimension,
        similarityMetric,
      });
      const index = await getIndex(indexName, { nodeLabel });
      return index;
    } catch (err) {
      logger.error(err, err.stack);
      throw err;
    } finally {
      session.close();
    }
  }

  async function dropIndex(indexName) {
    const q = `
      DROP INDEX ${indexName}
    `;
    const session = getClient().session();
    try {
      await session.run(q);
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      session.close();
    }
  }

  async function dropData(indexName, { nodeLabel }) {
    const q = `
      MATCH (n:\`${nodeLabel}\`)
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

  async function indexChunks(chunks, embeddings, params) {
    const {
      nodeLabel,
      batchSize = 1000,
    } = params;
    const data = chunks
      .map((chunk, i) => {
        const embedding = embeddings[i];
        if (embedding.length) {
          const props = Object.entries(flatten(chunk)).reduce((a, [k, v]) => {
            if (!['name'].includes(k) && !isObject(v)) {
              const key = k.replace(/\./g, '__');
              a[nodeLabel + '__' + key] = v;
            }
            return a;
          }, {});
          return {
            id: chunk.id,
            name: chunk.name,
            embedding,
            props,
          };
        }
        return null;
      })
      .filter(x => x !== null);
    const q = `
      UNWIND $data AS row
      CALL { WITH row
        MERGE (c:\`${nodeLabel}\` {id: row.id})
        WITH c, row
        CALL db.create.setVectorProperty(c, 'embedding', row.embedding)
        YIELD node
        SET c.name = row.name
        SET c += row.props
      } IN TRANSACTIONS OF toInteger($batchSize) ROWS
    `;
    const session = getClient().session();
    try {
      await session.run(q, { batchSize, data });
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      await session.close();
    }
    return chunks.map(chunk => chunk.id);
  }

  async function getNumberChunks(indexName, params) {
    const { nodeLabel } = params;
    const q = `
      MATCH (n:\`${nodeLabel}\`)
      RETURN COUNT(n) AS k
    `;
    const session = getClient().session();
    try {
      const r = await session.run(q);
      const k = r.records[0].get('k');
      return +k;
    } catch (err) {
      logger.error(err, err.stack);
      throw err;
    } finally {
      await session.close();
    }
  }

  async function deleteChunks(ids) {
    const q = `
      MATCH (n) WHERE n.id IN $ids
      DETACH DELETE n
    `;
    const session = getClient().session();
    try {
      await session.run(q, { ids });
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      await session.close();
    }
  }

  async function deleteChunk(id) {
    const q = `
      MATCH (n) WHERE n.id = $id
      DETACH DELETE n
    `;
    const session = getClient().session();
    try {
      await session.run(q, { id });
    } catch (err) {
      logger.error(err);
      throw err;
    } finally {
      await session.close();
    }
  }

  async function search(indexName, query, attrs, logicalType, params) {
    const {
      queryEmbedding,
      keywordIndexName,
      type = 'vector',
      k = 6,
    } = params;
    let q;
    if (type === 'vector') {
      q = `
        CALL db.index.vector.queryNodes($indexName, $k, $queryEmbedding)
        YIELD node, score
      `;
    } else if (type === 'hybrid') {
      q = `
        CALL {
          CALL db.index.vector.queryNodes($indexName, $k, $queryEmbedding)
          YIELD node, score
          RETURN node, score UNION
          CALL db.index.fulltext.queryNodes($keywordIndexName, $query, {limit: $k})
          YIELD node, score
          WITH collect({node:node, score:score}) as nodes, max(score) AS max
          UNWIND nodes AS n
          RETURN n.node AS node, (n.score / max) AS score
        }
        WITH node, max(score) AS score
        ORDER BY score DESC
        LIMIT $k
      `;
    } else {
      throw new Error(`Unsupported search type: ${type}`);
    }
    q += `
      RETURN
        node.text AS text,
        node.id AS id,
        node {
          .*,
          id: Null,
          text: Null,
          embedding: Null
        } AS metadata,
        score
    `;
    const searchParams = {
      indexName,
      query,
      queryEmbedding,
      keywordIndexName,
      k,
    };
    const session = getClient().session();
    try {
      const r = await session.run(q, searchParams);
      return r.records.map(r => ({
        id: r.get('id'),
        text: r.get('text'),
        score: r.get('score'),
        ...Object.entries(r.get('metadata')).reduce((a, [k, v]) => {
          if (v !== null && typeof v !== 'undefined') {
            a[k] = v;
          }
          return a;
        }, {}),
      }));
    } catch (err) {
      logger.error(err, err.stack);
      return [];
    } finally {
      await session.close();
    }
  }

  return {
    __name,
    createIndex,
    deleteChunks,
    deleteChunk,
    dropData,
    dropIndex,
    getIndexes,
    getIndex,
    getNumberChunks,
    indexChunks,
    search,
  };
}

export default Neo4jService;
