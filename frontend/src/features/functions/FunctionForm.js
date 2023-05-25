import { useCallback, useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Col,
  Collapse,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
} from 'antd';
import { CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import ButterflyDataMapping from 'react-data-mapping';
import MonacoEditor from 'react-monaco-editor';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import ReactJson from 'react-json-view';
import isEmpty from 'lodash.isempty';
import isFunction from 'lodash.isfunction';
import isObject from 'lodash.isobject';

import { SchemaModalInput } from '../../components/SchemaModalInput';
import { TagsInput } from '../../components/TagsInput';
import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import {
  createFunctionAsync,
  getFunctionAsync,
  updateFunctionAsync,
  runTestAsync,
  selectLoaded,
  selectFunctions,
  selectTestResult,
  selectTestResultLoaded,
  selectTestResultLoading,
  setTestResult,
} from './functionsSlice';
import {
  getModelsAsync,
  selectLoaded as selectModelsLoaded,
  selectModels,
} from '../models/modelsSlice';
import {
  getPromptSetsAsync,
  selectLoaded as selectPromptSetsLoaded,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';
import {
  createSettingAsync,
  getSettingAsync,
  selectSettings,
  updateSettingAsync,
} from '../promptSets/settingsSlice';

import 'react-data-mapping/dist/index.css';

const { Panel } = Collapse;
const { TextArea } = Input;

const TAGS_KEY = 'functionTags';

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const returnTypeOptions = [
  {
    label: 'application/json',
    value: 'application/json',
  },
  {
    label: 'text/plain',
    value: 'text/plain',
  },
];

const transformationOptions = [
  {
    label: 'Convert to array',
    value: 'convertToArray',
  },
];

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

export function FunctionForm() {

  const [existingTags, setExistingTags] = useState([]);
  const [formData, setFormData] = useState(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedImplementation, setSelectedImplementation] = useState(-1);

  const functions = useSelector(selectFunctions);
  const loaded = useSelector(selectLoaded);
  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);
  const promptSets = useSelector(selectPromptSets);
  const promptSetsLoaded = useSelector(selectPromptSetsLoaded);
  const settings = useSelector(selectSettings);
  const testResult = useSelector(selectTestResult);
  const testResultLoaded = useSelector(selectTestResultLoaded);
  const testResultLoading = useSelector(selectTestResultLoading);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();

  const argumentsValue = Form.useWatch('arguments', form);
  const implementationsValue = Form.useWatch('implementations', form);
  const returnTypeValue = Form.useWatch('returnType', form);
  const returnTypeSchema = Form.useWatch('returnTypeSchema', form);

  const id = location.pathname.match(/\/functions\/(.*)/)[1];
  const func = functions[id];
  const isNew = id === 'new';

  const modelOptions = Object.values(models).map((m) => ({
    label: m.name,
    value: m.id,
  }));

  const promptSetOptions = Object.values(promptSets).map((s) => ({
    label: s.name,
    value: s.id,
  }));

  const formIsReady = (
    loaded &&
    modelsLoaded &&
    promptSetsLoaded &&
    func !== null
  );

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Semantic Function',
    }));
    if (!isNew) {
      dispatch(getFunctionAsync(id));
    }
    dispatch(getModelsAsync());
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getPromptSetsAsync({ workspaceId: selectedWorkspace.id }));
      dispatch(getSettingAsync({
        workspaceId: selectedWorkspace.id,
        key: TAGS_KEY,
      }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    const tagsSetting = settings[TAGS_KEY];
    if (tagsSetting) {
      setExistingTags(tagsSetting.value || []);
    }
  }, [settings]);

  const handleTest = (index) => {
    setSelectedImplementation(index);
    setIsTestModalOpen(true);
  };

  const handleClose = () => {
    setIsTestModalOpen(false);
    setTimeout(() => {
      setSelectedImplementation(-1);
      setFormData(null);
      dispatch(setTestResult({ result: null }));
    }, 200);
  };

  const onCancel = () => {
    navigate('/functions');
  };

  const onFinish = (values) => {
    if (isNew) {
      dispatch(createFunctionAsync({
        values: {
          ...values,
        },
      }));
    } else {
      dispatch(updateFunctionAsync({
        id,
        values: {
          ...func,
          ...values,
        },
      }));
    }
    updateExistingTags(values.tags || []);
    navigate('/functions');
  };

  const updateExistingTags = (tags) => {
    console.log('settings:', settings);
    const setting = settings[TAGS_KEY];
    console.log('setting:', setting, TAGS_KEY);
    const newTags = [...new Set([...existingTags, ...tags])];
    newTags.sort((a, b) => a < b ? -1 : 1);
    const values = {
      workspaceId: selectedWorkspace.id,
      key: TAGS_KEY,
      value: newTags,
    };
    if (setting) {
      dispatch(updateSettingAsync({ id: setting.id, values }));
    } else {
      dispatch(createSettingAsync({ values }));
    }
  };

  const monacoOptions = {
    selectOnLineNumbers: true,
  };

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

  const getPromptSet = (index) => {
    if (implementationsValue && promptSetsLoaded) {
      const impl = implementationsValue[index];
      if (impl) {
        const id = impl.promptSetId;
        if (id) {
          return promptSets[id];
        }
      }
    }
    return undefined;
  };

  const getModelArguments = (index) => {
    const model = getModel(index);
    if (model) {
      if (model.type === 'gpt') {
        const promptSet = getPromptSet(index);
        if (promptSet) {
          return promptSet.arguments;
        }
      } else {
        return model.arguments;
      }
    }
    return undefined;
  };

  const getModelArgumentProperties = (index) => {
    return getModelArguments(index)?.properties;
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

  const isSimpleArgumentMappingEnabled = (index) => {
    return !isEmpty(argumentsValue?.properties) && !isEmpty(getModelArgumentProperties(index));
  };

  const isAdvancedArgumentMappingEnabled = (index) => {
    return argumentsValue && getModelArguments(index);
  };

  const isModelApiType = (index) => {
    return getModel(index)?.type === 'api';
  };

  const isModelGptType = (index) => {
    return getModel(index)?.type === 'gpt';
  };

  const getFunctionArgumentProperties = () => {
    return argumentsValue?.properties;
  };

  const getFunctionReturnTypeProperties = () => {
    return returnTypeSchema?.properties;
  };

  const isSimpleReturnTypeMappingEnabled = (index) => {
    return isModelApiType(index) && !isEmpty(getFunctionReturnTypeProperties()) && !isEmpty(getModelReturnTypeProperties(index));
  };

  const isAdvancedReturnTypeMappingEnabled = (index) => {
    return returnTypeSchema && getModelReturnTypeSchema(index);
  };

  const runTest = async ({ formData }) => {
    const impl = func.implementations[selectedImplementation];
    if (impl) {
      dispatch(runTestAsync({
        args: formData,
        modelId: impl.modelId,
        name: func.name,
      }));
    }
  };

  const uiSchema = {
    "ui:submitButtonOptions": {
      "props": {
        "loading": testResultLoading,
        "type": "primary",
      },
      "submitText": "Run",
    },
  };

  const PanelHeader = ({ title }) => (
    <div style={{ borderBottom: '1px solid #d9d9d9' }}>
      {title}
    </div>
  );

  function ArgumentMappingModalInput({ index, onChange, value }) {

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
      setState(null);
      setReady(false);
    }

    const getMappingData = useCallback((val) => {
      return Object.entries(val).map(([k, v]) => ({
        source: v,
        target: k,
      }));
    }, []);

    const isObjectNested = useCallback((obj) => {
      if (isObject(obj)) {
        return Object.values(obj).some(v => Array.isArray(v) || isObject(v) || isFunction(v));
      }
      return false;
    }, []);

    const isSimpleEnabled = isSimpleArgumentMappingEnabled(index);
    const isAdvancedEnabled = isAdvancedArgumentMappingEnabled(index);
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
          if (isObject(v) && Object.values(v).length === 0) return true;
          return false;
        } catch (err) {
          return true;
        }
      }
      if (isObject(val) && Object.values(val).length === 0) return true;
      return false;
    }, []);

    // console.log('value:', value, typeof value, noState(value))

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
        >
          {!ready ?
            <div>Loading...</div>
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
                    <Button
                      disabled={isAdvanced && !isSimple}
                      onClick={() => setIsAdvanced((current) => !current)}
                    >
                      {isAdvanced ? 'Simple' : 'Advanced'}
                    </Button>
                  </Space>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                {!isAdvanced && isSimple ?
                  <ButterflyDataMapping
                    className="butterfly-data-mapping container single-with-header"
                    type="single"
                    columns={columns}
                    sourceData={getFields('Request Arguments', getFunctionArgumentProperties())}
                    targetData={getFields(isModelApiType(index) ? 'Model Arguments' : 'Prompt Arguments', getModelArgumentProperties(index))}
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
            Have both function and model/prompt arguments been defined?
          </div>
          : null
        }
      </>
    );
  }

  function ReturnTypeMappingModalInput({ index, onChange, value }) {

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
        >
          {!ready ?
            <div>Loading...</div>
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
                    {isSimpleEnabled ?
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

  if (!isNew && !formIsReady) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      {!isNew && !isEmpty(func) ?
        <Modal
          onCancel={handleClose}
          onOk={handleClose}
          open={isTestModalOpen}
          title={'Test ' + func?.name}
          okText={'Done'}
          width={800}
          bodyStyle={{
            maxHeight: 600,
            overflowY: 'auto',
          }}
        >
          <div style={{ width: 720 }}>
            <div style={{ float: 'right' }}>
              <Button type="default"
                disabled={isEmpty(formData)}
                onClick={() => { setFormData(null); }}
              >
                Clear Inputs
              </Button>
            </div>
            <SchemaForm
              schema={func?.arguments}
              uiSchema={uiSchema}
              validator={validator}
              formData={formData}
              onChange={(e) => setFormData(e.formData)}
              onSubmit={runTest}
            />
          </div>
          {!isEmpty(testResult) && testResultLoaded ?
            <div style={{ marginBottom: 20, marginTop: 16, width: 720 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Result:</div>
              {func.returnType === 'application/json' ?
                <ReactJson src={testResult} />
                :
                <div>{String(testResult.content)}</div>
              }
            </div>
            : null
          }
        </Modal>
        : null
      }
      <div style={{ marginTop: 20 }}>
        <Form
          {...layout}
          form={form}
          name="function"
          autoComplete="off"
          onFinish={onFinish}
          initialValues={func}
        >
          {/* <Collapse defaultActiveKey={['1']} ghost> */}
          {/* <Panel header={<PanelHeader title="Function Details" />} key="1" forceRender> */}
          <Form.Item
            label="Name"
            name="name"
            rules={[
              {
                required: true,
                message: 'Please enter a function name',
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Description"
            name="description"
          >
            <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
          </Form.Item>
          <Form.Item
            label="Tags"
            name="tags"
          >
            <TagsInput existingTags={existingTags} />
          </Form.Item>
          {/* </Panel> */}
          {/* <Panel header={<PanelHeader title="Function Arguments" />} key="2" forceRender> */}
          <Form.Item
            label="Arguments"
            name="arguments"
          >
            <SchemaModalInput />
          </Form.Item>
          {/* </Panel> */}
          {/* <Panel header={<PanelHeader title="Function Return" />} key="3" forceRender> */}
          <Form.Item label="Return Type">
            <Form.Item
              name="returnType"
              style={{ display: 'inline-block', width: 350 }}
            >
              <Select options={returnTypeOptions} />
            </Form.Item>
            {returnTypeValue === 'application/json' ?
              <Form.Item
                name="returnTypeSchema"
                style={{ display: 'inline-block', marginLeft: 16 }}
              >
                <SchemaModalInput />
              </Form.Item>
              : null
            }
          </Form.Item>
          {/* </Panel> */}
          {/* <Panel header={<PanelHeader title="Model Implementations" />} key="4" forceRender> */}
          <Form.List name="implementations">
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map((field, index) => (
                  <Row key={field.key} style={{
                    marginBottom: '8px',
                  }}>
                    <Col span={4} className="my-form-item-label">
                      {index === 0 ?
                        <label title="Implementations">Implementations</label>
                        : null
                      }
                    </Col>
                    <Col span={6} style={{
                      border: '1px solid #d9d9d9',
                      borderLeftRadius: '6px',
                      borderRight: 'none',
                      padding: '8px 20px',
                    }}>
                      <Form.Item
                        name={[field.name, 'modelId']}
                        label="Model"
                        labelCol={{ span: 24 }}
                        wrapperCol={{ span: 24 }}
                        rules={[
                          {
                            required: true,
                            message: 'Please select a model',
                          },
                        ]}
                      >
                        <Select options={modelOptions} />
                      </Form.Item>
                      {getModel(index)?.type === 'gpt' ?
                        <Form.Item
                          name={[field.name, 'promptSetId']}
                          label="Prompt"
                          labelCol={{ span: 24 }}
                          wrapperCol={{ span: 24 }}
                        >
                          <Select options={promptSetOptions} />
                        </Form.Item>
                        : null
                      }
                      {/* {getModel(index)?.type === 'api' ?
                        <Form.Item
                          name={[field.name, 'url']}
                          label="URL"
                          labelCol={{ span: 24 }}
                          wrapperCol={{ span: 24 }}
                        >
                          <Input />
                        </Form.Item>
                        : null
                      } */}
                      <Form.Item
                        colon={false}
                        name={[field.name, 'isDefault']}
                        label="Default?"
                        labelCol={{ span: 24 }}
                        wrapperCol={{ span: 24 }}
                        valuePropName="checked"
                        initialValue={index === 0}
                      >
                        <Switch />
                      </Form.Item>
                      {!isNew ?
                        <div style={{ marginTop: 20 }}>
                          <Button type="primary" onClick={() => { handleTest(index); }}>Test</Button>
                        </div>
                        : null
                      }
                    </Col>
                    <Col span={13} style={{
                      border: '1px solid #d9d9d9',
                      borderRightRadius: '6px',
                      borderLeft: 'none',
                      overflowX: 'auto',
                      padding: '8px 20px',
                    }}>
                      <>
                        <div style={{ paddingBottom: 8 }}>
                          <label style={{
                            alignItems: 'center',
                            display: 'inline-flex',
                            height: 32,
                            lineHeight: '22px',
                          }}>
                            Argument Mapping
                          </label>
                        </div>
                        <Form.Item
                          colon={false}
                          name={[field.name, 'mappingData']}
                          wrapperCol={{ span: 24 }}
                          initialValue={[]}
                        >
                          <ArgumentMappingModalInput index={index} />
                        </Form.Item>
                        <div style={{ paddingBottom: 8 }}>
                          <label style={{
                            alignItems: 'center',
                            display: 'inline-flex',
                            height: 32,
                            lineHeight: '22px',
                          }}>
                            Return Type Mapping
                          </label>
                        </div>
                        {isModelGptType(index) ?
                          <>
                            <Form.Item
                              name={[field.name, 'returnTransformation']}
                              wrapperCol={{ span: 12 }}
                            >
                              <Select allowClear options={transformationOptions} />
                            </Form.Item>
                            <Divider orientation="left" plain>Alternatively</Divider>
                          </>
                          : null
                        }
                        <Form.Item
                          colon={false}
                          name={[field.name, 'returnMappingData']}
                          wrapperCol={{ span: 24 }}
                          initialValue={[]}
                        >
                          <ReturnTypeMappingModalInput index={index} />
                        </Form.Item>
                      </>
                    </Col>
                    <Col span={1}>
                      {fields.length ? (
                        <div style={{ marginLeft: 16 }}>
                          <Button type="text"
                            icon={<CloseOutlined />}
                            className="dynamic-delete-button"
                            onClick={() => remove(field.name)}
                          />
                        </div>
                      ) : null}
                    </Col>
                  </Row>
                ))}
                <Form.Item wrapperCol={{ offset: 4, span: 6 }}>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    style={{ width: '100%', zIndex: 101 }}
                    icon={<PlusOutlined />}
                  >
                    Add Implementation
                  </Button>
                  <Form.ErrorList errors={errors} />
                </Form.Item>
              </>
            )}
          </Form.List>
          {/* </Panel> */}
          {/* </Collapse> */}
          <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
            <Space>
              <Button type="default" onClick={onCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save</Button>
            </Space>
          </Form.Item>
        </Form>
      </div >
    </>
  );
}