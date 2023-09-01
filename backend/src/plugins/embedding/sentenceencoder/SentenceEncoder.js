import '@tensorflow/tfjs-node';
import use from '@tensorflow-models/universal-sentence-encoder';

function SentenceEncoder({ __name, constants, logger }) {

  let model;
  use.load().then(m => { model = m });

  async function createEmbedding(content) {
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
