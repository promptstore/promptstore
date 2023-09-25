import isObject from 'lodash.isobject';

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
