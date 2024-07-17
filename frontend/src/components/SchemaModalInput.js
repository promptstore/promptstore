import { useCallback, useEffect, useState } from 'react';
import { Button, Modal } from 'antd';
import { JsonSchemaEditor } from '@markmo/json-schema-editor-antd';
import { CheckOutlined } from '@ant-design/icons';
import isEmpty from 'lodash.isempty';
import isObject from 'lodash.isobject';

export function SchemaModalInput({
  buttonProps,
  isSpec,
  onChange,
  placeholders,
  title = 'Set Schema',
  value,
}) {

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [state, setState] = useState(null);

  useEffect(() => {
    setState(value);
  }, [value]);

  const handleClose = (ev) => {
    setIsModalOpen(false);
    setState(value);
  };

  const handleOk = () => {
    if (typeof onChange === 'function') {
      onChange(state);
    }
    setIsModalOpen(false);
    setState(null);
  }

  const noState = useCallback((val) => {
    if (isEmpty(val)) return true;
    if (typeof val === 'string') {
      try {
        // TODO
        const v = eval(`(${val})`);
        if (isObject(v) && Object.values(v).length === 0) return true;
        return false;
      } catch (err) {
        return true;
      }
    }
    if (isObject(val) && Object.values(val).length === 0) return true;
    return false;
  }, []);

  return (
    <>
      <Modal
        onCancel={handleClose}
        onOk={handleOk}
        open={isModalOpen}
        title={title}
        width={'75%'}
      >
        <div className="bodyScroll">
          <JsonSchemaEditor
            onChange={setState}
            value={state}
            placeholders={placeholders}
            isSpec={isSpec}
          />
        </div>
      </Modal>
      <Button
        icon={noState(value) ? null : <CheckOutlined />}
        onClick={() => setIsModalOpen(true)}
        {...buttonProps}
      >
        {title}
      </Button>
    </>
  );
}
