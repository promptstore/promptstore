import axios from 'axios';
import fetch from 'node-fetch';
import uuid from 'uuid';
import { createParser } from 'eventsource-parser';

import { delay } from '../../../core/conversions';

function Llama2LLM({ __name, constants, logger }) {

  const OpenAIStream = async (request) => {
    const url = constants.LLAMA2_BASE_PATH + '/v1/chat/completions';
    logger.debug('url:', url);
    request = {
      model: '/models/llama-2-7b-chat.bin',
      messages: request.messages,
      max_tokens: request.max_tokens,
      temperature: 1,
      stream: true,
    };
    logger.debug('request:', request);
    // const res = await axios.post(url, request, {
    //   headers: {
    //     'Content-Type': 'application/json',
    //   }
    // });
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-XXXXXXXXXXXXXXXXXXXX',
        'OpenAI-Organization': '',
      },
      method: 'POST',
      body: JSON.stringify(request),
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    if (res.status !== 200) {
      throw new Error('api returned ' + res.status);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const onParse = (event) => {
          if (event.type === 'event') {
            const data = event.data;
            try {
              const json = JSON.parse(data);
              if (json.choices[0].finish_reason != null) {
                controller.close();
                return;
              }
              const text = json.choices[0].delta.content;
              const queue = encoder.encode(text);
              controller.enqueue(queue);
            } catch (err) {
              controller.error(err.message);
            }
          }
        };

        const parser = createParser(onParse);
        for await (const chunk of res.body) {
          parser.feed(decoder.decode(chunk));
        }
      }
    });

    return stream;
  };

  const streamToString = (stream) => {
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  };

  async function createChatCompletion(request, retryCount = 0) {
    let res;
    try {
      const stream = await OpenAIStream(request);
      const content = await streamToString(stream);
      return {
        id: uuid.v4(),
        created: new Date(),
        model: request.model,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content,
            }
          }
        ]
      };
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      if (res?.data.error?.message.startsWith('That model is currently overloaded with other requests')) {
        if (retryCount > 2) {
          throw new Error('Exceeded retry count: ' + err.message, { cause: err });
        }
        await delay(2000);
        return createChatCompletion(request, retryCount + 1);
      }
    }
  }

  async function createCompletion(request, retryCount = 0) {
    let res;
    try {
      res = await openai.createCompletion(request);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      if (res?.data.error?.message.startsWith('That model is currently overloaded with other requests')) {
        if (retryCount > 2) {
          throw new Error('Exceeded retry count: ' + err.message, { cause: err });
        }
        await delay(2000);
        return createCompletion(request, retryCount + 1);
      }
    }
  }

  function getNumberTokens(model, text) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    getNumberTokens,
  };

}

export default Llama2LLM;
