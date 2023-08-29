import { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom'
import { Button, Modal, Space } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import ButterflyDataMapping from 'react-data-mapping';
import MonacoEditor from 'react-monaco-editor';
import isEmpty from 'lodash.isempty';
import isFunction from 'lodash.isfunction';
import isObject from 'lodash.isobject';

import NavbarContext from '../contexts/NavbarContext';

const monacoOptions = { selectOnLineNumbers: true };

const columns = [
  {
    key: 'id',
    title: 'ID',
    width: 30,
  },
  {
    key: 'property',
    title: 'Property',
    render: (val, row, index) => {
      return <div>{val}</div>
    },
    primaryKey: true,
    width: 150,
  },
  {
    key: 'type',
    title: 'Type',
    width: 75,
  }
];

const getFields = (title, properties) => ({
  title,
  fields: Object.entries(properties).map(([k, v], i) => ({
    id: i + 1,
    property: k,
    type: v.type,
  }))
});

export function MappingModalInput({
  sourceSchema,
  targetSchema,
  disabledMessage,
  sourceTitle,
  targetTitle,
  onChange,
  value,
  buttonProps,
}) {

  if (!disabledMessage) {
    disabledMessage = 'Have both source and target schemas been defined?';
  }

  const [isAdvanced, setIsAdvanced] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState('');

  // console.log('state:', state, typeof state);

  const { isDarkMode } = useContext(NavbarContext);

  useEffect(() => {
    if (value && typeof value === 'string') {
      setState(value);
    }
  }, [value]);

  const handleClose = () => {
    setIsModalOpen(false);
    if (value && typeof value === 'string') {
      setState(value);
    }
    setReady(false);
  };

  const handleMappingDataChange = (args) => {
    if (args && args.mappingData) {
      const data = args.mappingData.reduce((a, x) => {
        a[x.target] = x.source;
        return a;
      }, {});
      const stateUpdate = JSON.stringify(data, null, 2);
      setState(stateUpdate);
    }
  };

  const handleOk = () => {
    if (typeof onChange === 'function') {
      onChange(state);
    }
    setIsModalOpen(false);
    setState('');
    setReady(false);
  }

  const getMappingData = useCallback((val) => {
    return Object.entries(val).map(([k, v]) => ({
      source: v,
      target: k,
    }));
  }, []);

  const isObjectNested = useCallback((obj) => {
    if (!isObject(obj)) return false;
    return Object.values(obj)
      .some(v => Array.isArray(v) || isObject(v) || isFunction(v));
  }, []);

  const getProperties = useCallback((schema) => {
    if (!schema) return null;
    if (schema.type === 'array') {
      return schema.items.properties;
    }
    return schema.properties;
  }, []);

  const isSimpleEnabled = !(isEmpty(getProperties(sourceSchema)) || isEmpty(getProperties(targetSchema)));
  const isAdvancedEnabled = sourceSchema && targetSchema;

  let isSimple = isSimpleEnabled;
  let mappingData = [];
  if (isSimpleEnabled && state) {
    try {
      const obj = JSON.parse(state);
      mappingData = getMappingData(obj);
    } catch (err) {
      try {
        const val = eval(`(${state})`);
        if (isObject(val) && !isFunction(val) && !isObjectNested(val)) {
          mappingData = getMappingData(val);
        } else {
          isSimple = false;
        }
      } catch (e) {
        isSimple = false;
      }
    }
  }

  const noState = useCallback((val) => {
    if (isEmpty(val)) return true;
    if (typeof val === 'string') {
      try {
        const v = eval(`(${val})`);
        if (isObject(v) && Object.values(v).length) return false;
        if (isFunction(v)) return false;
        return true;
      } catch (err) {
        return true;
      }
    }
    if (isObject(val) && Object.values(val).length) return false;
    return true;
  }, []);

  return (
    <>
      <Modal
        afterOpenChange={(open) => {
          if (open) {
            setTimeout(() => {
              setReady(true);
            }, 400);
          }
        }}
        onCancel={handleClose}
        onOk={handleOk}
        open={isModalOpen}
        title="Set Mapping"
        width={788}
        wrapClassName="mapping-modal"
      >
        {!ready ?
          <div style={{ height: 448 }}>Loading...</div>
          : null
        }
        {ready ?
          <>
            <div style={{ display: 'flex' }}>
              <div style={{ marginLeft: 'auto' }}>
                <Space>
                  <Button onClick={() => setState('')}>
                    Clear
                  </Button>
                  {isSimple ?
                    <Button
                      disabled={isAdvanced && !isSimple}
                      onClick={() => setIsAdvanced((current) => !current)}
                    >
                      {isAdvanced ? 'Simple' : 'Advanced'}
                    </Button>
                    : null
                  }
                  <Link to={process.env.REACT_APP_DATA_MAPPER_HELP_URL} target="_blank" rel="noopener noreferrer">Need help?</Link>
                </Space>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              {!isAdvanced && isSimple ?
                <ButterflyDataMapping
                  className="butterfly-data-mapping container single-with-header"
                  type="single"
                  columns={columns}
                  sourceData={getFields(sourceTitle, getProperties(sourceSchema))}
                  targetData={getFields(targetTitle, getProperties(targetSchema))}
                  config={{}}
                  onEdgeClick={(data) => {
                    // console.log(data);
                  }}
                  width="auto"
                  onChange={handleMappingDataChange}
                  mappingData={mappingData}
                />
                : null
              }
              {isAdvanced || !isSimple ?
                <MonacoEditor
                  height={250}
                  language="javascript"
                  theme={isDarkMode ? 'vs-dark' : 'vs-light'}
                  options={monacoOptions}
                  onChange={setState}
                  value={state}
                />
                : null
              }
            </div>
          </>
          : null
        }
      </Modal>
      <Button
        disabled={!isSimpleEnabled && !isAdvancedEnabled}
        icon={noState(value) ? null : <CheckOutlined />}
        onClick={() => setIsModalOpen(true)}
        {...buttonProps}
      >
        Set Mapping
      </Button>
      {!isSimpleEnabled && !isAdvancedEnabled ?
        <div style={{ color: 'rgba(0,0,0,0.45)', marginTop: 8 }}>
          {disabledMessage}
        </div>
        : null
      }
    </>
  );
}
