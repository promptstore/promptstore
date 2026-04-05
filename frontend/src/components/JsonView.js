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
