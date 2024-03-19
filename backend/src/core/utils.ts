import axios from 'axios';
import isObject from 'lodash.isobject';

import {
  ChatRequest,
  ChatResponse,
  ContentObject,
  ImageContent,
  Message,
} from './conversions/RosettaStone';

export const convertImageToBase64 = (imageUrl: string) => {
  return new Promise((resolve, reject) => {
    axios.get(imageUrl, { responseType: 'arraybuffer' })
      .then(res => {
        const dataUrl =
          `data:${res.headers['content-type']};base64,` +
          Buffer.from(res.data).toString('base64');
        resolve(dataUrl);
      })
      .catch(reject);
  });
};

export const convertImageToBase64Only = (imageUrl: string) => {
  return new Promise((resolve, reject) => {
    axios.get(imageUrl, { responseType: 'arraybuffer' })
      .then(res => {
        const base64 = Buffer.from(res.data).toString('base64');
        resolve(base64);
      })
      .catch(reject);
  });
};

async function convertObjectWithImages(obj: any) {
  if (isObject(obj)) {
    const a = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'imageUrl' || k === 'image_url') {
        a[k] = await convertImageToBase64(String(v));
      } else {
        a[k] = await convertObjectWithImages(v);
      }
    }
    return a;
  }
  if (Array.isArray(obj)) {
    const a = [];
    for (const el of obj) {
      a.push(convertObjectWithImages(el));
    }
    return await Promise.all(a);
  }
  return obj;
}

export async function convertMessagesWithImages(messages: Message[]) {
  if (!messages) return undefined;
  const msgs = [];
  for (const m of messages) {
    if (Array.isArray(m.content)) {
      const content = [];
      for (const c of m.content) {
        if (typeof c === 'string') {
          content.push(c);
          continue;
        }
        const contentObject = c as ContentObject;
        if (contentObject.type === 'image_url') {
          const imageContent = c as ImageContent;
          const url = await convertImageToBase64(imageContent.image_url.url);
          content.push({ ...c, image_url: { url } });
          continue;
        }
        content.push(c);
      }
      msgs.push({ ...m, content });
      continue;
    }
    // if (m.function_call) {
    //   const args = JSON.parse(m.function_call.arguments);
    //   const newArgs = await convertObjectWithImages(args);
    //   const function_call = {
    //     ...m.function_call,
    //     arguments: JSON.stringify(newArgs),
    //   };
    //   msgs.push({ ...m, function_call });
    //   continue;
    // }
    msgs.push(m);
  }
  return msgs;
}

export async function convertResponseWithImages(response: ChatResponse) {
  const choices = [];
  for (const choice of response.choices) {
    const newMessages = await convertMessagesWithImages([choice.message]);
    choices.push({ ...choice, message: newMessages[0] });
  }
  return { ...response, choices };
}

export async function convertRequestWithImages(request: ChatRequest) {
  return {
    ...request,
    prompt: {
      ...request.prompt,
      history: await convertMessagesWithImages(request.prompt.history),
      messages: await convertMessagesWithImages(request.prompt.messages),
    },
  };
}