import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Modal, Segmented, Space, Tooltip, message } from 'antd';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CopyOutlined,
  DownOutlined,
  ExpandOutlined,
  UpOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import JsonViewComponent from 'react18-json-view';
import 'react18-json-view/src/style.css';

export function JsonView({ collapsed, enableClipboard = false, src, style, theme }) {
  if (src === null || typeof src === 'undefined') {
    return 'none';
  }
  let json;
  if (typeof src === 'string') {
    try {
      json = JSON.parse(src);
    } catch (err) {
      return (
        <div>
          <span
            style={{ color: 'rgba(0, 0, 0, 0.45)', fontStyle: 'italic' }}
          >(invalid json)</span> {src}
        </div>
      );
    }
  } else {
    json = src;
  }
  const collapseDepth = collapsed === true ? 1 : (typeof collapsed === 'number' ? collapsed : undefined);
  const dark = theme === 'grayscale';
  return (
    <div style={style}>
      <JsonViewComponent
        src={json}
        collapsed={collapseDepth}
        enableClipboard={enableClipboard}
        dark={dark}
        theme="default"
      />
    </div>
  );
}

// ---- helpers -------------------------------------------------------------

const PATH_SEP = '␟';
const COLORS = {
  punct: '#64748b',
  key: '#0b7285',
  string: '#c2410c',
  number: '#6d28d9',
  boolean: '#2563eb',
  null: '#94a3b8',
};

function isContainer(v) {
  return v !== null && typeof v === 'object';
}

function entriesOf(v) {
  return Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v);
}

function valueToText(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  return String(v);
}

// Decode HTML entities (&quot; &amp; &#39; …) using the browser's parser.
// A textarea's value is decoded without executing markup, so this is safe.
function decodeEntities(str) {
  if (!str || str.indexOf('&') === -1) return str;
  if (typeof document === 'undefined') return str;
  const el = document.createElement('textarea');
  el.innerHTML = str;
  return el.value;
}

// Coerce a value that may be a JSON string, an object, or plain text into a
// parsed JS value. Returns { value, isJson } — isJson is false for plain
// (non-JSON) strings so callers can fall back to text rendering.
function coerceJson(src) {
  if (typeof src === 'string') {
    const trimmed = src.trim();
    if (trimmed && (trimmed[0] === '{' || trimmed[0] === '[')) {
      try {
        return { value: JSON.parse(src), isJson: true };
      } catch (err) {
        // fall through — treat as plain string
      }
    }
    return { value: src, isJson: false };
  }
  return { value: src, isJson: true };
}

// A one-line, character-truncated summary of a JSON value for inline display.
function previewText(value, maxLen = 160) {
  let str;
  if (typeof value === 'string') {
    str = value;
  } else {
    try {
      str = JSON.stringify(value);
    } catch (err) {
      str = String(value);
    }
  }
  str = str.replace(/\s+/g, ' ').trim();
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// Walk the value tree in render order to (a) enumerate every case-insensitive
// match of `query` across keys and primitive values, (b) map each text location
// to the ordered list of global match indices it contains, and (c) collect the
// paths of containers that must be force-opened so matches are visible.
function buildSearchIndex(json, query) {
  const matches = [];
  const matchMap = new Map();
  const forceOpen = new Set();
  const q = query ? query.toLowerCase() : '';

  const addText = (text, pk, field) => {
    if (!q) return;
    const lower = text.toLowerCase();
    const mapKey = pk + '|' + field;
    let from = 0;
    let idx = lower.indexOf(q, from);
    while (idx !== -1) {
      const gi = matches.length;
      matches.push({ pathKey: pk, field });
      let arr = matchMap.get(mapKey);
      if (!arr) { arr = []; matchMap.set(mapKey, arr); }
      arr.push(gi);
      from = idx + q.length;
      idx = lower.indexOf(q, from);
    }
  };

  const walk = (value, path) => {
    const pk = path.join(PATH_SEP);
    const before = matches.length;
    if (isContainer(value)) {
      for (const [k, v] of entriesOf(value)) {
        const childPath = [...path, k];
        if (typeof k === 'string') addText(k, childPath.join(PATH_SEP), 'key');
        walk(v, childPath);
      }
    } else {
      addText(valueToText(value), pk, 'value');
    }
    if (matches.length > before) forceOpen.add(pk);
  };

  walk(json, []);
  return { matches, matchMap, forceOpen, count: matches.length };
}

// Split a flat text blob into segments around case-insensitive matches of
// `query`, tagging each match with a running index for navigation.
function flatSegments(text, query) {
  if (!query) return { segments: [{ text, match: false }], count: 0 };
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const segments = [];
  let from = 0;
  let idx = lower.indexOf(q, from);
  let count = 0;
  while (idx !== -1) {
    if (idx > from) segments.push({ text: text.slice(from, idx), match: false });
    segments.push({ text: text.slice(idx, idx + q.length), match: true, index: count });
    count += 1;
    from = idx + q.length;
    idx = lower.indexOf(q, from);
  }
  if (from < text.length) segments.push({ text: text.slice(from), match: false });
  return { segments, count };
}

// Render `text`, wrapping the search-match substrings in <mark> elements that
// register themselves in ctx.matchRefs (by global index) for scroll navigation.
function highlight(text, ctx, mapKey) {
  const q = ctx.query;
  const indices = q ? ctx.matchMap.get(mapKey) : null;
  if (!q || !indices || !indices.length) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const out = [];
  let from = 0;
  let occ = 0;
  let idx = lower.indexOf(ql, from);
  while (idx !== -1 && occ < indices.length) {
    if (idx > from) out.push(text.slice(from, idx));
    const gi = indices[occ];
    out.push(
      <mark
        key={gi}
        ref={(el) => { ctx.matchRefs.current[gi] = el; }}
        style={{ background: gi === ctx.activeIndex ? '#fb923c' : '#fde68a', color: 'inherit', borderRadius: 2 }}
      >
        {text.slice(idx, idx + ql.length)}
      </mark>,
    );
    from = idx + ql.length;
    occ += 1;
    idx = lower.indexOf(ql, from);
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
}

function nodeIsOpen(pk, depth, ctx) {
  if (depth === 0) return true;
  if (ctx.query && ctx.forceOpen.has(pk)) return true;
  if (Object.prototype.hasOwnProperty.call(ctx.overrides, pk)) return ctx.overrides[pk];
  if (ctx.mode === 'all-open') return true;
  if (ctx.mode === 'all-closed') return false;
  return depth < ctx.defaultDepth;
}

// Recursive collapsible node. Objects/arrays get a clickable caret; primitives
// render inline. Keys and primitive values are highlighted via ctx.
function JsonNode({ value, name, path, depth, ctx }) {
  const pk = path.join(PATH_SEP);
  const indent = { paddingLeft: depth === 0 ? 0 : 12 };
  const keyNode = name != null && typeof name === 'string'
    ? <span style={{ color: COLORS.key }}>{highlight(name, ctx, path.join(PATH_SEP) + '|key')}</span>
    : (name != null ? <span style={{ color: COLORS.null }}>{name}</span> : null);

  if (!isContainer(value)) {
    let color = COLORS.null;
    let display;
    if (value === null) { color = COLORS.null; display = 'null'; }
    else if (typeof value === 'string') { color = COLORS.string; display = <>&quot;{highlight(value, ctx, pk + '|value')}&quot;</>; }
    else if (typeof value === 'number') { color = COLORS.number; display = highlight(String(value), ctx, pk + '|value'); }
    else if (typeof value === 'boolean') { color = COLORS.boolean; display = String(value); }
    else { display = highlight(String(value), ctx, pk + '|value'); }
    return (
      <div style={indent}>
        {keyNode}{keyNode ? <span style={{ color: COLORS.punct }}>: </span> : null}
        <span style={{ color }}>{display}</span>
      </div>
    );
  }

  const isArr = Array.isArray(value);
  const entries = entriesOf(value);
  const openBr = isArr ? '[' : '{';
  const closeBr = isArr ? ']' : '}';
  const open = nodeIsOpen(pk, depth, ctx);
  const size = entries.length;
  const toggle = () => ctx.toggle(pk, !open);

  const header = (
    <span onClick={toggle} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ color: COLORS.punct, marginRight: 2, fontSize: 10 }}>
        {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
      </span>
      {keyNode}{keyNode ? <span style={{ color: COLORS.punct }}>: </span> : null}
      <span style={{ color: COLORS.punct }}>{openBr}</span>
      {!open ? (
        <span style={{ color: COLORS.null }}> {size} {isArr ? 'items' : 'keys'} <span style={{ color: COLORS.punct }}>{closeBr}</span></span>
      ) : null}
    </span>
  );

  return (
    <div style={indent}>
      {header}
      {open ? (
        <>
          <div>
            {entries.map(([k, v]) => (
              <JsonNode key={String(k)} value={v} name={k} path={[...path, k]} depth={depth + 1} ctx={ctx} />
            ))}
          </div>
          <div><span style={{ color: COLORS.punct }}>{closeBr}</span></div>
        </>
      ) : null}
    </div>
  );
}

// Full-screen modal that renders a JSON value as a collapsible tree with
// built-in text search (highlight + prev/next navigation, auto-expanding
// matches), expand/collapse-all controls, and copy-to-clipboard.
export function FullScreenJsonViewer({ open, onClose, src, title = 'JSON' }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [overrides, setOverrides] = useState({});
  const [mode, setMode] = useState('all-open');
  const matchRefs = useRef([]);

  const json = useMemo(() => coerceJson(src).value, [src]);
  const { matchMap, forceOpen, count } = useMemo(() => buildSearchIndex(json, query), [json, query]);

  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => { if (open) { setOverrides({}); setMode('all-open'); setQuery(''); } }, [open, src]);

  useEffect(() => {
    matchRefs.current.length = count;
    const el = matchRefs.current[active];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [active, count, query]);

  const go = (delta) => {
    if (!count) return;
    setActive((a) => (a + delta + count) % count);
  };

  const toggle = (pk, next) => {
    setMode('default');
    setOverrides((o) => ({ ...o, [pk]: next }));
  };

  const text = useMemo(() => {
    if (typeof json === 'string') return json;
    try { return JSON.stringify(json, null, 2); } catch (err) { return String(json); }
  }, [json]);

  const copy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => message.success('Copied JSON to clipboard'),
        () => message.error('Copy failed'),
      );
    }
  };

  const ctx = {
    query, matchMap, forceOpen, activeIndex: active, matchRefs,
    overrides, mode, defaultDepth: 1, toggle,
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      style={{ top: 24, paddingBottom: 0 }}
      styles={{ body: { padding: 0 } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 32, flexWrap: 'wrap' }}>
          <span style={{ flexShrink: 0 }}>{title}</span>
          <Input
            allowClear
            autoFocus
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPressEnter={(e) => go(e.shiftKey ? -1 : 1)}
            style={{ maxWidth: 280 }}
          />
          {query ? (
            <>
              <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', minWidth: 56, textAlign: 'center' }}>
                {count ? `${active + 1} / ${count}` : '0 / 0'}
              </span>
              <Space.Compact>
                <Tooltip title="Previous match (Shift+Enter)">
                  <Button size="small" icon={<UpOutlined />} disabled={!count} onClick={() => go(-1)} />
                </Tooltip>
                <Tooltip title="Next match (Enter)">
                  <Button size="small" icon={<DownOutlined />} disabled={!count} onClick={() => go(1)} />
                </Tooltip>
              </Space.Compact>
            </>
          ) : null}
          <Space.Compact>
            <Button size="small" onClick={() => { setOverrides({}); setMode('all-open'); }}>Expand all</Button>
            <Button size="small" onClick={() => { setOverrides({}); setMode('all-closed'); }}>Collapse all</Button>
          </Space.Compact>
          <Tooltip title="Copy JSON">
            <Button size="small" icon={<CopyOutlined />} onClick={copy} />
          </Tooltip>
        </div>
      }
    >
      <div
        style={{
          margin: 0,
          height: '78vh',
          overflow: 'auto',
          padding: 16,
          fontSize: 12,
          lineHeight: 1.6,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          background: '#f6f6f4',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <JsonNode value={json} name={null} path={[]} depth={0} ctx={ctx} />
      </div>
    </Modal>
  );
}

// Full-screen modal for a text blob. "Formatted" renders markdown with HTML
// entities decoded; "Plain" shows the decoded raw text with built-in search
// (highlight + prev/next navigation). Copy-to-clipboard in both modes.
export function FullScreenTextViewer({ open, onClose, text, title = 'Content' }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [view, setView] = useState('formatted');
  const matchRefs = useRef([]);
  const body = text == null ? '' : String(text);
  const decoded = useMemo(() => decodeEntities(body), [body]);

  const { segments, count } = useMemo(() => flatSegments(decoded, query), [decoded, query]);

  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => { if (open) { setView('formatted'); setQuery(''); } }, [open, text]);
  useEffect(() => {
    matchRefs.current.length = count;
    const el = matchRefs.current[active];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [active, count, query]);

  const go = (delta) => {
    if (!count) return;
    setActive((a) => (a + delta + count) % count);
  };

  const copy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(decoded).then(
        () => message.success('Copied to clipboard'),
        () => message.error('Copy failed'),
      );
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      style={{ top: 24, paddingBottom: 0 }}
      styles={{ body: { padding: 0 } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 32, flexWrap: 'wrap' }}>
          <span style={{ flexShrink: 0 }}>{title}</span>
          <Segmented
            size="small"
            value={view}
            onChange={setView}
            options={[{ label: 'Formatted', value: 'formatted' }, { label: 'Plain', value: 'plain' }]}
          />
          {view === 'plain' ? (
            <>
              <Input
                allowClear
                autoFocus
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onPressEnter={(e) => go(e.shiftKey ? -1 : 1)}
                style={{ maxWidth: 280 }}
              />
              {query ? (
                <>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', minWidth: 56, textAlign: 'center' }}>
                    {count ? `${active + 1} / ${count}` : '0 / 0'}
                  </span>
                  <Space.Compact>
                    <Tooltip title="Previous match (Shift+Enter)">
                      <Button size="small" icon={<UpOutlined />} disabled={!count} onClick={() => go(-1)} />
                    </Tooltip>
                    <Tooltip title="Next match (Enter)">
                      <Button size="small" icon={<DownOutlined />} disabled={!count} onClick={() => go(1)} />
                    </Tooltip>
                  </Space.Compact>
                </>
              ) : null}
            </>
          ) : null}
          <Tooltip title="Copy">
            <Button size="small" icon={<CopyOutlined />} onClick={copy} />
          </Tooltip>
        </div>
      }
    >
      {view === 'formatted' ? (
        <div
          className="markdown"
          style={{ margin: 0, height: '78vh', overflow: 'auto', padding: 16, fontSize: 13, lineHeight: 1.6, background: '#f6f6f4' }}
        >
          <ReactMarkdown>{body}</ReactMarkdown>
        </div>
      ) : (
        <div
          style={{
            margin: 0,
            height: '78vh',
            overflow: 'auto',
            padding: 16,
            fontSize: 13,
            lineHeight: 1.6,
            background: '#f6f6f4',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {segments.map((seg, i) =>
            seg.match ? (
              <mark
                key={i}
                ref={(el) => { matchRefs.current[seg.index] = el; }}
                style={{ background: seg.index === active ? '#fb923c' : '#fde68a', color: 'inherit', borderRadius: 2 }}
              >
                {seg.text}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </div>
      )}
    </Modal>
  );
}

// Inline plain-text display: a clamped preview with an "Expand" affordance that
// opens the full-screen text viewer. Short text renders inline with no viewer.
export function TextField({ text, title = 'Content', style }) {
  const [open, setOpen] = useState(false);
  const body = text == null ? '' : String(text);
  const preview = decodeEntities(body);
  const long = body.length > 200 || (body.match(/\n/g) || []).length > 3;
  if (!long) {
    return (
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, ...style }}>{preview}</div>
    );
  }
  return (
    <div style={style}>
      <div style={{ background: '#f6f6f4', borderRadius: 4, padding: '6px 8px' }}>
        {/* Clamp + overflow live on a padding-free inner box, otherwise
            overflow:hidden clips at the border edge and the bottom padding
            reveals a sliver of the 4th line. */}
        <div
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            // Wrap normally (collapse source newlines) so line-clamp counts
            // lines reliably; pre-wrap leaks a partial 4th line.
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            fontSize: 12,
          }}
        >
          {preview}
        </div>
      </div>
      <Button
        type="link"
        size="small"
        icon={<ExpandOutlined />}
        onClick={() => setOpen(true)}
        style={{ padding: 0, height: 'auto', fontSize: 12, marginTop: 2 }}
      >
        Show full ({body.length.toLocaleString()} chars)
      </Button>
      <FullScreenTextViewer open={open} onClose={() => setOpen(false)} text={body} title={title} />
    </div>
  );
}

// Inline JSON display: a truncated one-line summary with an "Expand" affordance
// that opens the full-screen searchable viewer. Falls back to the text viewer
// for non-JSON strings.
export function JsonField({ src, title = 'JSON', maxLen = 160, style }) {
  const [open, setOpen] = useState(false);
  if (src === null || typeof src === 'undefined') {
    return <span style={{ color: 'rgba(0,0,0,0.45)' }}>none</span>;
  }
  const { value, isJson } = coerceJson(src);
  if (!isJson) {
    // Plain text — truncated preview + full-screen text viewer.
    return <TextField text={value} title={title} style={style} />;
  }
  return (
    <div style={style}>
      <div
        onClick={() => setOpen(true)}
        title="Click to expand"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          background: '#f6f6f4',
          borderRadius: 4,
          padding: '6px 8px',
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'rgba(0,0,0,0.75)',
          }}
        >
          {previewText(value, maxLen)}
        </span>
        <ExpandOutlined style={{ color: '#1677ff', flexShrink: 0 }} />
      </div>
      <FullScreenJsonViewer open={open} onClose={() => setOpen(false)} src={value} title={title} />
    </div>
  );
}
