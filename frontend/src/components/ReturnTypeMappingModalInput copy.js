import { useCallback, useEffect, useState } from 'react';
import isEmpty from 'lodash.isempty';
import isFunction from 'lodash.isfunction';
import isObject from 'lodash.isobject';

export function ReturnTypeMappingModalInput({
  implementationsValue,
  index,
  modelsLoaded,
  onChange,
  returnTypeSchema,
  value,
}) {

  // ------ shared

  const getModel = (index) => {
    if (implementationsValue && modelsLoaded) {
      const impl = implementationsValue[index];
      if (impl) {
        const id = impl.modelId;
        if (id) {
          return models[id];
        }
      }
    }
    return undefined;
  };

  const isModelApiType = (index) => {
    return getModel(index)?.type === 'api';
  };

  // ------

  const getFunctionReturnTypeProperties = () => {
    return returnTypeSchema?.properties;
  };

  const getModelReturnTypeSchema = (index) => {
    const model = getModel(index);
    if (model) {
      return model.returnTypeSchema;
    }
    return undefined;
  };

  const getModelReturnTypeProperties = (index) => {
    return getModelReturnTypeSchema(index)?.properties;
  };

  const isAdvancedReturnTypeMappingEnabled = (index) => {
    return returnTypeSchema && getModelReturnTypeSchema(index);
  };

  const isSimpleReturnTypeMappingEnabled = (index) => {
    return isModelApiType(index) && !isEmpty(getFunctionReturnTypeProperties()) && !isEmpty(getModelReturnTypeProperties(index));
  };


  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(null);

  useEffect(() => {
    if (value && typeof value === 'string') {
      setState(value);
    }
  }, [value]);

  const handleClose = () => {
    setIsModalOpen(false);
    setState(value);
    setReady(false);
  };

  const handleMappingDataChange = (args) => {
    if (args && args.mappingData) {
      const data = args.mappingData.reduce((a, x) => {
        a[x.source] = x.target;
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
    setState(null);
    setReady(false);
  }

  const getMappingData = useCallback((val) => {
    return Object.entries(val).map(([k, v]) => ({
      source: k,
      target: v,
    }));
  }, []);

  const isObjectNested = useCallback((obj) => {
    if (isObject(obj)) {
      return Object.values(obj).some(v => Array.isArray(v) || isObject(v) || isFunction(v));
    }
    return false;
  }, []);

  const isSimpleEnabled = isSimpleReturnTypeMappingEnabled(index);
  const isAdvancedEnabled = isAdvancedReturnTypeMappingEnabled(index);

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
                  <Button onClick={() => setState(null)}>
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
                </Space>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              {!isAdvanced && isSimple ?
                <ButterflyDataMapping
                  className="butterfly-data-mapping container single-with-header"
                  type="single"
                  columns={columns}
                  sourceData={getFields('Model Return', getModelReturnTypeProperties(index))}
                  targetData={getFields('Function Return', getFunctionReturnTypeProperties())}
                  config={{}}
                  onEdgeClick={(data) => {
                    console.log(data);
                  }}
                  width="auto"
                  height={400}
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
      >
        Set Mapping
      </Button>
      {!isSimpleEnabled && !isAdvancedEnabled ?
        <div style={{ color: 'rgba(0,0,0,0.45)', marginTop: 8 }}>
          Have both function and model return types been defined?
        </div>
        : null
      }
    </>
  );
}
