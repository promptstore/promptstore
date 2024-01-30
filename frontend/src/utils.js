import isObject from 'lodash.isobject';

const colors = {
  light: ['#87d068', '#2db7f5', '#ca3dd4', '#f56a00', '#7265e6', '#ffbf00', '#00a2ae'],
  dark: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.4)'],
};

/**
 * Creates a shallow clone of `obj`.
 * 
 * @param {object} obj 
 * @returns obj
 */
export const clone = (obj) => JSON.parse(JSON.stringify(obj));

export const decodeEntities = (() => {
  // this prevents any overhead from creating the object each time
  const element = document.createElement('div');
  let doubleDecoded = false;

  function decodeHTMLEntities(str) {
    return str;
    if (str && typeof str === 'string') {
      // strip script/html tags
      str = str.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
      str = str.replace(/<\/?\w(?:[^"'>]|"[^"]*"|'[^']*')*>/gmi, '');
      element.innerHTML = str;
      str = element.textContent;
      element.textContent = '';

      // TODO can double encoding be prevented - occurs when
      // message content included in another message - handlebars maybe
      if (str.includes('&#') && !doubleDecoded) {
        doubleDecoded = true;
        return decodeHTMLEntities(str);
      }
    }

    return str;
  }

  return decodeHTMLEntities;
})();

const numberFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,

  // These options are needed to round to whole numbers if that's what you want.
  // minimumFractionDigits: 0,  // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
  // maximumFractionDigits: 0,  // (causes 2500.99 to be printed as $2,501)
});

export const formatCurrency = (number) => numberFormatter.format(number);

const DEFAULT_CONTENT_PROPS = ['content', 'text', 'input'];

export const getInput = (args, batch) => {
  if (typeof args === 'string') {
    return args;
  }
  if (Array.isArray(args) && args.length) {
    if (batch) {
      return args.map(x => getInput(x, batch));
    }
    return getInput(args[0]);
  }
  if (isObject(args)) {
    if (args.contentProp) {
      return getInput(args[args.contentProp], batch);
    }
    const contentProp = DEFAULT_CONTENT_PROPS.find(p => args[p]);
    if (contentProp) {
      return getInput(args[contentProp], batch);
    }
  }
  return null;
};

export const hashIndex = (key, n) => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash += key.charCodeAt(i);
  }
  return hash % n;
};

/**
 * Translate `obj` into a unique string code.
 * 
 * @param {*} obj 
 * @returns str
 */
export const hashObj = (obj) => hashStr(JSON.stringify(obj));

/**
 * Translate `obj` into a unique 32 bit integer code.
 * 
 * @param {*} str 
 * @returns number
 */
export const hashStr = (str) => {
  var hash = 0, i, chr;
  if (str) {
    for (i = 0; i < str.length; i++) {
      chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
  }
  return String(Math.abs(hash));
};

export const intersects = (a, b) =>
  (a || []).filter(x => (b || []).includes(x)).length > 0;

export const getColor = (key, isDarkMode) => {
  if (!key) return 'rgba(0, 0, 0, 0.25)';
  if (isDarkMode) {
    return colors.dark[hashIndex(key, colors.dark.length)];
  }
  return colors.light[hashIndex(key, colors.light.length)];
};

export const notEmpty = (val) => {
  return typeof val === 'object' && val !== null && Object.keys(val).length;
};

/**
 * Sets the value at path `s` of object `o`.
 * 
 * !! Appears to behave differently to `lodash/set`.
 * 
 * @param {*} o 
 * @param {*} s 
 * @param {*} v 
 * @returns object with same root as `o`
 */
export const setNestedValue = (o, s, v) => {
  o = clone(o); // create a deep copy of `o`
  const r = o;  // assign return value at object root
  s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
  s = s.replace(/^\./, '');           // strip a leading dot
  const a = s.split('.');
  try {
    let p, k;
    for (let i = 0, n = a.length; i < n; ++i) {
      k = a[i];
      if (k in o) {
        p = o;
        o = o[k];
      } else {
        const val = {};
        if (Number.isInteger(k)) {
          o[a[i - 1]] = [{ [k]: val }];
        } else {
          o[k] = val;
        }
        p = o;
        o = val;
      }
    }
    p[k] = v;
  } catch (err) {
    console.warn('Error setting nested value:', err);
  }
  return r;
};

// Renders a date in the local timezone, including day of the week.
// e.g. 'Fri, 22 May 2020'
const dateFormatter = new Intl.DateTimeFormat(
  [], { 'year': 'numeric', 'month': 'long', 'day': 'numeric', 'weekday': 'short' }
)

// Renders an HH:MM time in the local timezone, including timezone info.
// e.g. '12:17 BST'
const timeFormatter = new Intl.DateTimeFormat(
  [], { 'hour': 'numeric', 'minute': 'numeric', 'timeZoneName': 'short' }
)

// Given an ISO 8601 date string, render it as a more friendly date
// in the user's timezone.
//
// Examples:
// - 'today @ 12:00 BST'
// - 'yesterday @ 11:00 CST'
// - 'Fri, 22 May 2020 @ 10:00 PST'
//
export const getHumanFriendlyDateString = (iso8601_date_string) => {
  const date = new Date(Date.parse(iso8601_date_string));

  // When are today and yesterday?
  const today = new Date();
  const yesterday = new Date().setDate(today.getDate() - 1);

  // We have to compare the *formatted* dates rather than the actual dates --
  // for example, if the UTC date and the localised date fall on either side
  // of midnight.
  // eslint-disable-next-line
  if (dateFormatter.format(date) == dateFormatter.format(today)) {
    return 'today @ ' + timeFormatter.format(date);
    // eslint-disable-next-line
  } else if (dateFormatter.format(date) == dateFormatter.format(yesterday)) {
    return 'yesterday @ ' + timeFormatter.format(date);
  } else {
    return dateFormatter.format(date) + ' @ ' + timeFormatter.format(date);
  }
};

// Given an ISO 8601 date string, render a human-friendly description
// of how long ago it was, if recent.
//
// Examples:
// - 'just now'
// - '10 seconds ago'
// - '20 minutes ago'
//
export const getHumanFriendlyDelta = (iso8601_date_string) => {
  const date = new Date(Date.parse(iso8601_date_string));
  const now = new Date();

  const deltaMilliseconds = now - date;
  const deltaSeconds = Math.floor(deltaMilliseconds / 1000);
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  const deltaHours = Math.floor(deltaMinutes / 60);
  const deltaDays = Math.floor(deltaHours / 24);

  if (deltaSeconds < 5) {
    return 'just now';
  } else if (deltaSeconds < 60) {
    return deltaSeconds + ' seconds ago';
    // eslint-disable-next-line
  } else if (deltaMinutes == 1) {
    return '1 minute ago';
  } else if (deltaMinutes < 60) {
    return deltaMinutes + ' minutes ago';
    // eslint-disable-next-line
  } else if (deltaHours == 1) {
    return '1 hour ago';
  } else if (deltaHours < 24) {
    return deltaHours + ' hours ago';
  } else {
    return deltaDays + ' days ago';
  }
};

export const slugify = (str) => {
  if (!str) return 'undefined';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
};

export const getExtension = (filepath) => {
  if (!filepath) return null;
  const index = filepath.lastIndexOf('.');
  return filepath.slice(index + 1);
};

export const getBaseURL = (endpoint) => {
  const url = new URL(endpoint);
  return `${url.protocol}//${url.hostname}`;
};

export const runWithMinDelay = (startTime, minDelay, fn) => {
  setTimeout(fn, minDelay - (new Date() - startTime));
};

export const formatNumber = (num, precision = 0) => {
  if (num) {
    num = +num;
    if (!isNaN(num)) {
      num = Math.round((num + Number.EPSILON) * Math.pow(10, precision)) / Math.pow(10, precision);
      return num.toLocaleString('en-US');
    }
  }
  return null;
}

export const formatPercentage = (number) => {
  const numberFormatter = new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 2,
  });

  return numberFormatter.format(number);
};
