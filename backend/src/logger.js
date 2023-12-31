import LokiTransport from 'winston-loki';
import isObject from 'lodash.isobject';
import isString from 'lodash.isstring';
import util from 'util';
import winston from 'winston';

const winstonConfig = {
  levels: {
    error: 0,
    debug: 1,
    warn: 2,
    data: 3,
    info: 4,
    verbose: 5,
    silly: 6,
    custom: 7
  },
  colors: {
    error: 'red',
    debug: 'blue',
    warn: 'yellow',
    data: 'grey',
    info: 'green',
    verbose: 'cyan',
    silly: 'magenta',
    custom: 'yellow'
  }
};

winston.addColors(winstonConfig.colors);

const SPLAT = Symbol.for('splat');

const { createLogger, format, transports } = winston;
const { colorize, combine, printf, timestamp } = format;

const formatObject = (value, i = 0, arr = []) => {
  if (isObject(value)) {
    if (i === arr.length - 1) {
      return '\n' + JSON.stringify(value, refReplacer(), 2);
    }
    return JSON.stringify(value);
  }
  if (isString(value)) {
    return value.trim();
  }
  return value;
};

const levelFilter = (level) => format((info) => {
  if (info.level !== level) {
    return false;
  }
  return info;
})();

const myFormat = printf((info) => {
  const splat = info[SPLAT] || [];
  let message, rest = '';
  if (isString(info.message) && info.message.match(/%[scdjifoO%]/g)) {
    message = util.format(info.message, ...splat);
  } else {
    message = formatObject(info.message, -1, splat);
    rest = splat.map(formatObject).join(' ');
  }
  return `${info.timestamp} ${info.level} ${message} ${rest}`;
});

const lokiFormat = printf((info) => {
  const splat = info[SPLAT] || [];
  let message, rest = '';
  if (isString(info.message) && info.message.match(/%[scdjifoO%]/g)) {
    message = util.format(info.message, ...splat);
  } else {
    message = formatObject(info.message, -1, splat);
    rest = splat.map(formatObject).join(' ');
  }
  return `content ${message} ${rest}`;
});

const logger = createLogger({
  levels: winstonConfig.levels,
  transports: [
    new transports.Console({
      format: combine(
        colorize(),
        timestamp(),
        myFormat,
      ),
      level: 'custom',
    }),
    new LokiTransport({
      host: process.env.LOKI_API_URL,
      format: combine(
        levelFilter('custom'),
        lokiFormat,
      ),
      level: 'custom',
    }),
  ],
});

const refReplacer = () => {
  let m = new Map(), v = new Map(), init = null;

  // in TypeScript add "this: any" param to avoid compliation errors - as follows
  //    return function (this: any, field: any, value: any) {
  return function (field, value) {
    let p = m.get(this) + (Array.isArray(this) ? `[${field}]` : '.' + field);
    let isComplex = value === Object(value)

    if (isComplex) m.set(value, p);

    let pp = v.get(value) || '';
    let path = p.replace(/undefined\.\.?/, '');
    let val = pp ? `#REF:${pp[0] == '[' ? '$' : '$.'}${pp}` : value;

    !init ? (init = value) : (val === init ? val = "#REF:$" : 0);
    if (!pp && isComplex) v.set(value, path);

    return val;
  }
};

export default logger;
