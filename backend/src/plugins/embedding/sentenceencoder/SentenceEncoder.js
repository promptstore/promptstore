import '@tensorflow/tfjs-node';
import use from '@tensorflow-models/universal-sentence-encoder';

function SentenceEncoder({ __name, constants, logger }) {

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
        .reject(err => {
          reject(err);
        });
    });
  }

  async function createEmbedding(content) {
    const model = await getModel();
    const embedding = await model.embed(content);
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
