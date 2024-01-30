import { CohereClient } from 'cohere-ai';

function CohereLLM({ __name, constants, logger }) {

  let client;

  function getClient() {
    if (!client) {
      client = new CohereClient({
        token: constants.COHERE_API_KEY,
      });
    }
    return client;
  }

  async function rerank(model, documents, query, topN = 3) {
    const rerank = await getClient().rerank({
      model,
      documents: documents.map(text => ({ text })),
      query,
      topN,
    });
    return rerank;
  }

  return {
    __name,
    rerank,
  };

}

export default CohereLLM;
