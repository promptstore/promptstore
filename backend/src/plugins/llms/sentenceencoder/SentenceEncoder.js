import '@tensorflow/tfjs-node';
import use from '@tensorflow-models/universal-sentence-encoder';

function SentenceEncoder({ __name, __metadata, constants, logger }) {

  let _model;

  function getModel() {
    if (_model) {
      return Promise.resolve(_model);
    }
    return new Promise((resolve, reject) => {
      use.load()
        .then(m => {
          _model = m;
          resolve(m);
        })
        .catch(err => {
          logger.debug(err);
          reject(err);
        });
    });
  }

  async function createEmbedding(request) {
    // logger.debug('request:', request);
    const model = await getModel();
    // logger.debug('model:', model);
    // logger.debug('input len:', request.input.length);
    const res = await model.embed(request.input);
    const values = res.dataSync();
    const embeddings = split(Array.from(values), 512);
    // logger.debug('embeddings len:', embeddings.length);
    // logger.debug('embeddings:', embeddings);
    const data = embeddings.map((embedding, index) => ({
      index,
      object: 'embedding',
      embedding,
    }));
    return {
      object: 'list',
      data,
      model: 'sentenceencoder',
      usage: {
        prompt_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  const split = (arr, len) => {
    const splits = [];
    let j = 0;
    while (j < arr.length) {
      splits.push(arr.slice(j, j + len));
      j += len;
    }
    return splits;
  };

  return {
    __name,
    __metadata,
    createEmbedding,
  };

}

export default SentenceEncoder;
