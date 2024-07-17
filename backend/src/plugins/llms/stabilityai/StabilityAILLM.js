import Minio from 'minio';
import axios from 'axios';
import FormData from 'form-data';

import {
  fromStabilityAIImageResponse,
  toStabilityAIImageRequest,
} from './conversions';

function StabilityAILLM({ __name, constants, logger }) {

  const mc = new Minio.Client({
    endPoint: constants.S3_ENDPOINT,
    port: parseInt(constants.S3_PORT, 10),
    useSSL: constants.ENV !== 'dev',
    accessKey: constants.AWS_ACCESS_KEY,
    secretKey: constants.AWS_SECRET_KEY,
  });

  async function createImage(request) {
    let req = toStabilityAIImageRequest(request);
    req = {
      aspect_ratio: '16:9',
      model: 'sd3-turbo',
      prompt: req.prompt,
    };
    logger.debug('req:', req);
    const url = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';
    const res = await axios.postForm(
      url,
      axios.toFormData(req, new FormData()),
      {
        validateStatus: undefined,
        responseType: 'arraybuffer',
        headers: {
          Authorization: `Bearer ${constants.STABILITY_AI_API_KEY}`,
          Accept: 'application/json; type=image/png',
        },
      }
    );
    if (res.status === 200) {
      const response = await fromStabilityAIImageResponse(res.data, mc, constants, logger);
      return response;
    } else {
      throw new Error(`${res.status} - Error generating image`);
    }
  }

  return {
    __name,
    createImage,
  };

}

export default StabilityAILLM;
