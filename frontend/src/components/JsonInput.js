import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input } from 'antd';
import ReactJson from 'react-json-view';

const { TextArea } = Input;

function JsonInput({ value, onChange, onError, theme, height = 320 }) {

  const [isEditable, setIsEditable] = useState(false);
  const [jsonStr, setJsonStr] = useState(null);
  const [error, setError] = useState(null);
  const [element, setElement] = useState(null);

  useEffect(() => {
    setJsonStr(JSON.stringify(value, null, 2));
  }, [value]);

  const handleChange = useCallback((ev) => {
    try {
      const json = JSON.parse(ev.target.value);
      if (typeof onChange === 'function') {
        onChange(json);
      }
      setError(null);
      setIsEditable(false);
    } catch (err) {
      ev.stopImmediatePropagation();
      if (typeof onError === 'function') {
        onError(err);
      }
      setError(String(err));
    }
  }, []);

  const inputRef = useCallback((ref) => {
    if (ref) {
      setElement(ref.resizableTextArea.textArea);
    }
  });

  useEventListener('blur', 'onfocusout', handleChange, element, true);

  if (isEditable) {
    return (
      <div style={{ height }}>
        <TextArea ref={inputRef}
          autoSize={{ minRows: 4, maxRows: Math.floor(height / 23) }}
          onChange={(ev) => { setJsonStr(ev.target.value); }}
          value={jsonStr}
        />
        {error ?
          <div style={{ color: 'red' }}>
            {error}
          </div>
          : null
        }
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', height }}>
      <div style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: theme === 'dark' ? '#424242' : '#d9d9d9',
        borderRadius: '6px',
        flex: 1,
        marginRight: 8,
        padding: '4px 11px',
        overflowY: 'auto',
      }}>
        <ReactJson src={value}
          style={{ height: height - 10 }}
          theme={theme === 'dark' ? 'shapeshifter' : 'rjv-default'}
        />
      </div>
      <Button size="small" type="default"
        onClick={() => { setIsEditable(true); }}
      >
        Edit
      </Button>
    </div>
  );
}

function useEventListener(eventName, ieFallback, handler, element, useCapture = false) {

  // Create a ref that stores handler
  const savedHandler = useRef();

  // Update ref.current value if handler changes.
  // This allows our effect below to always get latest handler ...
  // ... without us needing to pass it in the effect deps array ...
  // ... and potentially cause the effect to re-run on every render.
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (element) {
      // Create event listener that calls handler function stored in ref
      const eventListener = (event) => savedHandler.current(event);

      if (element.addEventListener) {
        // Add event listener
        element.addEventListener(eventName, eventListener, useCapture);

        // Remove event listener on cleanup
        return () => {
          element.removeEventListener(eventName, eventListener);
        };
      } else {
        // IE compatibility
        element[ieFallback] = eventListener;

        // Remove event listener on cleanup
        return () => {
          delete element[ieFallback];
        }
      }
    }
  }, [eventName, element] // Re-run if eventName or element changes
  );
}

export default JsonInput;