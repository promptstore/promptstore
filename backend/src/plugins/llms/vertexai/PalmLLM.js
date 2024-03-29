import { GoogleAuth } from 'google-auth-library';
import { DiscussServiceClient, TextServiceClient } from '@google-ai/generativelanguage';

import {
  fromVertexAIChatResponse,
  fromVertexAICompletionResponse,
  fromVertexAIEmbeddingResponse,
  toVertexAIChatRequest,
  toVertexAICompletionRequest,
  toVertexAIEmbeddingRequest,
} from './conversions';

function PalmLLM({ __name, constants, logger }) {

  let chatClient;
  let completionClient;

  function getChatClient() {
    if (!chatClient) {
      chatClient = new DiscussServiceClient({
        authClient: new GoogleAuth().fromAPIKey(constants.GOOGLE_API_KEY),
      });
    }
    return chatClient;
  }

  function getCompletionClient() {
    if (!completionClient) {
      completionClient = new TextServiceClient({
        authClient: new GoogleAuth().fromAPIKey(constants.GOOGLE_API_KEY),
      });
    }
    return completionClient;
  }



  /**
   * interface PaLMChatRequest {
   *   model: string;  // The name of the model to use. Format: name=models/{model}.
   *   prompt: PaLMMessagePrompt;  // The structured textual input given to the model as a prompt. Given a prompt, the model will return what it predicts is the next message in the discussion.
   *   temperature?: number;  // Controls the randomness of the output. Must be positive. Typical values are in the range: [0.0,1.0]. Higher values produce a more random and varied response. A temperature of zero will be deterministic.
   *   candidate_count?: number;  // The maximum number of generated response messages to return. This value must be between [1, 8], inclusive. If unset, this will default to 1.
   *   top_p?: number;  // top_p configures the nucleus sampling. It sets the maximum cumulative probability of tokens to sample from. For example, if the sorted probabilities are [0.5, 0.2, 0.1, 0.1, 0.05, 0.05] a top_p of 0.8 will sample as [0.625, 0.25, 0.125, 0, 0, 0].
   *   top_k?: number;  // The maximum number of tokens to consider when sampling.. The API uses combined nucleus and top-k sampling. top_k sets the maximum number of tokens to sample from on each step.
   * }
   * 
   * @param {*} request 
   * @param {*} parserService
   * @param {*} retryCount 
   * @returns 
   */
  async function createChatCompletion(request, parserService, retryCount = 0) {
    const client = getChatClient();
    const req = toVertexAIChatRequest(request);
    const res = await client.generateMessage(req);
    const response = await fromVertexAIChatResponse(res[0], parserService);
    return {
      ...response,
      model: request.model,
    };
  }

  /**
   * interface PaLMCompletionRequest {
   *   model: string;
   *   prompt: TextPrompt;
   *   temperature?: number;  // Controls the randomness of the output. Note: The default value varies by model, see the Model.temperature attribute of the Model returned the getModel function. Values can range from [0.0,1.0], inclusive. A value closer to 1.0 will produce responses that are more varied and creative, while a value closer to 0.0 will typically result in more straightforward responses from the model.
   *   candidate_count?: number;  // The maximum number of generated response messages to return. This value must be between [1, 8], inclusive. If unset, this will default to 1.
   *   max_output_tokens?: number;  // The maximum number of tokens to include in a candidate. If unset, this will default to 64.
   *   top_p?: number;  // The maximum cumulative probability of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Tokens are sorted based on their assigned probabilities so that only the most liekly tokens are considered. Top-k sampling directly limits the maximum number of tokens to consider, while Nucleus sampling limits number of tokens based on the cumulative probability.
   *   top_k?: number;  // The maximum number of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Top-k sampling considers the set of top_k most probable tokens. Defaults to 40.
   *   safety_settings?: SafetySetting[];
   *   stop_sequences?: string | string[];  // A set of up to 5 character sequences that will stop output generation. If specified, the API will stop at the first appearance of a stop sequence. The stop sequence will not be included as part of the response.
   * }
   * 
   * @param {*} request 
   * @param {*} parserService
   * @returns 
   */
  async function createCompletion(request, parserService) {
    const client = getCompletionClient();
    const req = toVertexAICompletionRequest(request);
    const res = await client.generateText(req);
    const response = await fromVertexAICompletionResponse(res[0], parserService);
    return {
      ...response,
      model: request.model,
    };
  }

  /**
   * Response example:
   * [
   *   {
   *     "candidates": [
   *       {
   *         "safetyRatings": [
   *           {
   *             "category": "HARM_CATEGORY_DEROGATORY",
   *             "probability": "NEGLIGIBLE"
   *           },
   *           {
   *             "category": "HARM_CATEGORY_TOXICITY",
   *             "probability": "NEGLIGIBLE"
   *           },
   *           {
   *             "category": "HARM_CATEGORY_VIOLENCE",
   *             "probability": "LOW"
   *           },
   *           {
   *             "category": "HARM_CATEGORY_SEXUAL",
   *             "probability": "NEGLIGIBLE"
   *           },
   *           {
   *             "category": "HARM_CATEGORY_MEDICAL",
   *             "probability": "NEGLIGIBLE"
   *           },
   *           {
   *             "category": "HARM_CATEGORY_DANGEROUS",
   *             "probability": "NEGLIGIBLE"
   *           }
   *         ],
   *         "output": "Gamers, level up your game with a supercharged phone and data plan from . Unlimited data, blazing-fast speeds, and a sleek design that’ll make you stand out from the crowd. 🔥⛽️"
   *       }
   *     ],
   *     "filters": [],
   *     "safetyFeedback": []
   *   },
   *   null,
   *   null
   * ]
   */

  async function createEmbedding(request) {
    const { model } = request;
    const client = getCompletionClient();
    const req = toVertexAIEmbeddingRequest(request);
    let res;
    if ('texts' in req) {
      const { texts } = req;
      const proms = [];
      let i = 0;
      while (i < texts.length) {
        proms.push(client.batchEmbedText({ texts: texts.slice(i, i + 100), model }));
        i += 100;
      }
      const responses = await Promise.all(proms);
      const embeddings = responses.reduce((a, r) => {
        a.push(...r[0].embeddings);
        return a;
      }, []);
      res = { embeddings };
    } else {
      // returns an unexpected array
      const r = await client.embedText({ text: req.text, model });
      res = r[0];
    }
    const response = fromVertexAIEmbeddingResponse(res);
    return {
      ...response,
      model: request.model,
    };
  }

  function createImage(prompt, options) {
    throw new Error('Not implemented');
  }

  function generateImageVariant(imageUrl, options) {
    throw new Error('Not implemented');
  }

  function getNumberTokens(model, text) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    createEmbedding,
    createImage,
    generateImageVariant,
    getNumberTokens,
  };

}

export default PalmLLM;
