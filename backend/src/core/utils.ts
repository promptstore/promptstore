import axios from 'axios';
import isObject from 'lodash.isobject';

import { ContentObject, ImageContent, Message } from './conversions/RosettaStone';

export const getInputString = (args: any) => {
  if (typeof args === 'string') {
    return args;
  }
  if (Array.isArray(args) && args.length) {
    return getInputString(args[0]);
  }
  if (isObject(args)) {
    const input = args.content || args.text || args.input;
    if (input) {
      return getInputString(input);
    }
  }
  return null;
};

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

export async function convertMessagesWithImages(messages: Message[]) {
  const msgs = [];
  for (const m of messages) {
    if (m.role === 'user' && Array.isArray(m.content)) {
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
    msgs.push(m);
  }
  return msgs;
}