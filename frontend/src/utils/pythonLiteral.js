// Parser for Python `repr` output — the shape telemetry payloads arrive in when
// an instrumented app captures a provider SDK response with str()/repr()
// instead of a JSON dump. Covers dicts, lists, tuples, sets, strings (quote
// prefixes and triple quotes included), numbers, None/True/False, and dataclass
// -style constructor reprs such as ChatCompletion(id='…', choices=[…]).
//
// Strictly a reader: it never evaluates, and anything it does not recognise
// fails the parse rather than guessing, so callers can fall back to raw text.

const WS = /\s/;
const DIGIT = /[0-9]/;
const IDENT_START = /[A-Za-z_]/;
const IDENT_CHAR = /[A-Za-z_0-9.]/;
const STR_PREFIX = /^[bBuUrRfF]{1,2}$/;

const ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0', '\\': '\\', "'": "'", '"': '"', a: '\x07' };

class Parser {
  constructor(src) {
    this.src = src;
    this.pos = 0;
  }

  error(msg) {
    throw new SyntaxError(`${msg} at position ${this.pos}`);
  }

  ws() {
    while (this.pos < this.src.length && WS.test(this.src[this.pos])) this.pos += 1;
  }

  peek() {
    return this.src[this.pos];
  }

  eat(ch) {
    if (this.src[this.pos] !== ch) this.error(`expected '${ch}'`);
    this.pos += 1;
  }

  // value := string | number | None/True/False | dict/set | list | tuple | call
  value() {
    this.ws();
    if (this.pos >= this.src.length) this.error('unexpected end of input');
    const ch = this.peek();
    if (ch === '{') return this.braced();
    if (ch === '[') return this.sequence('[', ']');
    if (ch === '(') return this.sequence('(', ')');
    if (ch === "'" || ch === '"') return this.string();
    if (ch === '-' || ch === '+' || DIGIT.test(ch) || (ch === '.' && DIGIT.test(this.src[this.pos + 1]))) return this.number();
    if (IDENT_START.test(ch)) return this.word();
    return this.error(`unexpected character '${ch}'`);
  }

  // Python quotes strings with ' or ", optionally tripled, optionally prefixed
  // (b'', r'', f''). Raw strings keep their backslashes verbatim.
  string() {
    const q = this.peek();
    if (q !== "'" && q !== '"') this.error('expected a string');
    const triple = this.src.startsWith(q.repeat(3), this.pos);
    const delim = triple ? q.repeat(3) : q;
    this.pos += delim.length;
    let out = '';
    for (;;) {
      if (this.pos >= this.src.length) this.error('unterminated string');
      if (this.src.startsWith(delim, this.pos)) {
        this.pos += delim.length;
        return out;
      }
      const c = this.src[this.pos];
      if (c === '\\') {
        this.pos += 1;
        const e = this.src[this.pos];
        if (e === undefined) this.error('unterminated escape');
        this.pos += 1;
        if (e === 'x' || e === 'u' || e === 'U') {
          const len = e === 'x' ? 2 : (e === 'u' ? 4 : 8);
          const hex = this.src.substr(this.pos, len);
          if (hex.length < len || !/^[0-9a-fA-F]+$/.test(hex)) this.error('bad hex escape');
          this.pos += len;
          out += String.fromCodePoint(parseInt(hex, 16));
        } else if (e === '\n') {
          // line continuation — contributes nothing
        } else if (Object.prototype.hasOwnProperty.call(ESCAPES, e)) {
          out += ESCAPES[e];
        } else {
          out += '\\' + e;
        }
      } else {
        out += c;
        this.pos += 1;
      }
    }
  }

  // A string literal that may carry a b/r/u/f prefix, consumed by word().
  prefixedString(prefix) {
    if (!/[rR]/.test(prefix)) return this.string();
    const q = this.peek();
    const triple = this.src.startsWith(q.repeat(3), this.pos);
    const delim = triple ? q.repeat(3) : q;
    this.pos += delim.length;
    const from = this.pos;
    for (;;) {
      if (this.pos >= this.src.length) this.error('unterminated raw string');
      if (this.src.startsWith(delim, this.pos) && this.src[this.pos - 1] !== '\\') {
        const out = this.src.slice(from, this.pos);
        this.pos += delim.length;
        return out;
      }
      this.pos += 1;
    }
  }

  number() {
    const start = this.pos;
    // float('inf') / float('nan') repr as bare inf/nan, with an optional sign.
    const special = /^[+-]?(?:inf|infinity|nan)\b/i.exec(this.src.slice(this.pos));
    if (special) {
      this.pos += special[0].length;
      return /nan/i.test(special[0]) ? null : (special[0][0] === '-' ? -Infinity : Infinity);
    }
    const m = /^[+-]?(?:0[xXoObB][0-9a-fA-F_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?)[jJ]?/.exec(this.src.slice(this.pos));
    if (!m) this.error('bad number');
    this.pos += m[0].length;
    const text = m[0].replace(/_/g, '');
    if (/[jJ]$/.test(text)) return text; // complex — keep the literal text
    const n = /^[+-]?0[xXoObB]/.test(text) ? Number(text.replace(/^([+-]?)0[oO]/, '$10o')) : Number(text);
    if (Number.isNaN(n)) { this.pos = start; this.error('bad number'); }
    return n;
  }

  // Bare word: a keyword, a prefixed string, or a Name(...) constructor repr.
  word() {
    const start = this.pos;
    while (this.pos < this.src.length && IDENT_CHAR.test(this.src[this.pos])) this.pos += 1;
    const name = this.src.slice(start, this.pos);
    if (name === 'None') return null;
    if (name === 'True') return true;
    if (name === 'False') return false;
    if (name === 'Ellipsis') return '...';
    if (name === 'NaN' || name === 'nan') return null;
    if (name === 'inf' || name === 'Infinity') return Infinity;
    const next = this.peek();
    if ((next === "'" || next === '"') && STR_PREFIX.test(name)) return this.prefixedString(name);
    if (next === '(') return this.call(name);
    return this.error(`unknown name '${name}'`);
  }

  // Name(a, b, k=v) — the repr of a dataclass or pydantic model. Rendered as an
  // object so the tree viewer can walk it; __type keeps the class name visible.
  call(name) {
    this.eat('(');
    const out = { __type: name };
    const positional = [];
    for (;;) {
      this.ws();
      if (this.peek() === ')') { this.pos += 1; break; }
      const argStart = this.pos;
      let key = null;
      if (IDENT_START.test(this.peek() || '')) {
        let p = this.pos;
        while (p < this.src.length && IDENT_CHAR.test(this.src[p])) p += 1;
        let q = p;
        while (q < this.src.length && WS.test(this.src[q])) q += 1;
        if (this.src[q] === '=' && this.src[q + 1] !== '=') {
          key = this.src.slice(this.pos, p);
          this.pos = q + 1;
        }
      }
      const v = this.value();
      if (key === null) {
        if (this.pos === argStart) this.error('empty argument');
        positional.push(v);
      } else {
        out[key] = v;
      }
      this.ws();
      if (this.peek() === ',') { this.pos += 1; continue; }
      if (this.peek() === ')') { this.pos += 1; break; }
      this.error('expected , or ) in call');
    }
    if (positional.length) out.__args = positional;
    return out;
  }

  // '{' opens either a dict (k: v) or a set (bare values); '{}' is a dict.
  braced() {
    this.eat('{');
    this.ws();
    if (this.peek() === '}') { this.pos += 1; return {}; }
    const dict = {};
    const set = [];
    let isSet = null;
    for (;;) {
      this.ws();
      if (this.peek() === '}') { this.pos += 1; break; }
      const k = this.value();
      this.ws();
      if (this.peek() === ':') {
        if (isSet === true) this.error('mixed set and dict entries');
        isSet = false;
        this.pos += 1;
        // Non-string dict keys (ints, tuples) stringify the way Python prints them.
        dict[typeof k === 'string' ? k : JSON.stringify(k)] = this.value();
      } else {
        if (isSet === false) this.error('mixed set and dict entries');
        isSet = true;
        set.push(k);
      }
      this.ws();
      if (this.peek() === ',') { this.pos += 1; continue; }
      if (this.peek() === '}') { this.pos += 1; break; }
      this.error('expected , or } ');
    }
    return isSet ? set : dict;
  }

  sequence(open, close) {
    this.eat(open);
    const out = [];
    for (;;) {
      this.ws();
      if (this.peek() === close) { this.pos += 1; break; }
      out.push(this.value());
      this.ws();
      if (this.peek() === ',') { this.pos += 1; continue; }
      if (this.peek() === close) { this.pos += 1; break; }
      this.error(`expected , or ${close}`);
    }
    return out;
  }
}

// Does `str` look like a Python literal worth attempting? Cheap gate so plain
// prose is never run through the parser.
export function looksLikePythonLiteral(str) {
  if (typeof str !== 'string') return false;
  const s = str.trim();
  if (!s) return false;
  if (s[0] === '{' || s[0] === '[' || s[0] === '(') {
    return /'|None|True|False|\(/.test(s);
  }
  return /^[A-Za-z_][A-Za-z_0-9.]*\(/.test(s) && s.endsWith(')');
}

// Parse a Python repr into plain JS data. Returns { ok, value } — ok is false
// (and value undefined) whenever the input is not a literal we fully understand.
export function parsePythonLiteral(str) {
  if (typeof str !== 'string') return { ok: false };
  try {
    const p = new Parser(str);
    const value = p.value();
    p.ws();
    if (p.pos !== p.src.length) return { ok: false };
    return { ok: true, value };
  } catch (err) {
    return { ok: false };
  }
}
