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

  async function createEmbedding(input) {
    // logger.debug('input:', input);
    const model = await getModel();
    // logger.debug('model:', model);
    const embedding = await model.embed(input);
    const values = embedding.dataSync();
    return Array.from(values);
  }

  return {
    __name,
    __metadata,
    createEmbedding,
  };

}

export default SentenceEncoder;
