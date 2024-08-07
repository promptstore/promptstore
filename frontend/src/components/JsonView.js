import ReactJson from 'react-json-view';

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
  return (
    <ReactJson
      name={false}
      collapsed={collapsed}
      displayObjectSize={false}
      enableClipboard={enableClipboard}
      theme={theme || 'grayscale:inverted'}
      iconStyle="square"
      style={{ backgroundColor: 'none', ...style }}
      src={json}
    />
  );
}