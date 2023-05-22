import { useContext, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AutoComplete,
  Button,
  Col,
  Collapse,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { JsonSchemaEditor } from '@markmo/json-schema-editor-antd';
import ButterflyDataMapping from 'react-data-mapping';
import MonacoEditor from 'react-monaco-editor';
// import SchemaForm from '@markmo/antd-schema-form';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import ReactJson from 'react-json-view';
import isEmpty from 'lodash.isempty';

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

import 'react-data-mapping/dist/index.css';
// import '@markmo/antd-schema-form/style/antd-schema-form.css';

const { Panel } = Collapse;
const { TextArea } = Input;

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

const existingTags = ['one', 'two', 'three'];

const tagInputStyle = {
  width: 78,
  verticalAlign: 'top',
};

const tagPlusStyle = {
  background: 'inherit',
  borderStyle: 'dashed',
  cursor: 'pointer',
};

const getFields = (title, properties) => ({
  title,
  fields: Object.entries(properties).map(([k, v], i) => ({
    id: i + 1,
    property: k,
    type: v.type,
  }))
});

export function FunctionForm() {

  const [activeTab, setActiveTab] = useState('1');
  const [activeReturnTab, setActiveReturnTab] = useState('1');
  const [formData, setFormData] = useState(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedImplementation, setSelectedImplementation] = useState(-1);

  const [editInputIndex, setEditInputIndex] = useState(-1);
  const [editInputValue, setEditInputValue] = useState(null);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [tags, setTags] = useState([]);

  const functions = useSelector(selectFunctions);
  const loaded = useSelector(selectLoaded);
  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);
  const promptSets = useSelector(selectPromptSets);
  const promptSetsLoaded = useSelector(selectPromptSetsLoaded);
  const testResult = useSelector(selectTestResult);
  const testResultLoaded = useSelector(selectTestResultLoaded);
  const testResultLoading = useSelector(selectTestResultLoading);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const inputRef = useRef(null);
  const editInputRef = useRef(null);

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
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (inputVisible) {
      inputRef.current?.focus();
    }
  }, [inputVisible]);

  useEffect(() => {
    editInputRef.current?.focus();
  }, [inputValue]);

  const handleTabChange = (ev) => {
    setActiveTab(String(ev.target.value));
  };

  const handleReturnTabChange = (ev) => {
    setActiveReturnTab(String(ev.target.value));
  };

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

  const handleCloseTag = (removedTag) => {
    const newTags = tags.filter((tag) => tag !== removedTag);
    setTags(newTags);
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
    navigate('/functions');
  };

  const showInput = () => {
    setInputVisible(true);
  };

  const handleAutocompleteChange = (value) => {
    setInputValue(value);
  };

  const handleInputConfirm = () => {
    const t = tags || [];
    if (inputValue && t.indexOf(inputValue) === -1) {
      setTags((current) => [...current, ...t]);
    }
    setInputVisible(false);
    setInputValue('');
  };

  const handleEditInputChange = (e) => {
    setEditInputValue(e.target.value);
  };

  const handleEditInputConfirm = () => {
    const newTags = [...tags];
    newTags[editInputIndex] = editInputValue;
    setTags(newTags);
    setEditInputIndex(-1);
    setInputValue('');
  };

  const onSelect = (data) => {
    console.log('onSelect', data);
  };

  const search = (text) => {
    return existingTags
      .filter((t) => t.startsWith(text))
      .map((value) => ({ value }))
      ;
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

  // const runTest = async (form, value, keys) => {
  //   dispatch(runTestAsync({ args: value, name: func.name }));
  // };
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
          {/* <SchemaForm
          json={func.arguments}
          onOk={runTest}
          okText="Run"
        /> */}
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
                <div>{String(testResult)}</div>
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
          <Collapse defaultActiveKey={['1']} ghost>
            <Panel header={<PanelHeader title="Function Details" />} key="1" forceRender>
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
                <TextArea autoSize={{ minRows: 3, maxRows: 14 }} />
              </Form.Item>
              <Form.Item
                label="Tags"
                name="tags"
              >
                <Space size={[0, 8]} wrap>
                  <Space size={[0, 8]} wrap>
                    {(tags || []).map((tag, index) => {
                      if (editInputIndex === index) {
                        return (
                          <Input
                            ref={editInputRef}
                            key={tag}
                            size="small"
                            style={tagInputStyle}
                            value={editInputValue}
                            onChange={handleEditInputChange}
                            onBlur={handleEditInputConfirm}
                            onPressEnter={handleEditInputConfirm}
                          />
                        );
                      }
                      const isLongTag = tag.length > 20;
                      const tagElem = (
                        <Tag
                          key={tag}
                          closable={true}
                          style={{
                            userSelect: 'none',
                          }}
                          onClose={() => handleCloseTag(tag)}
                        >
                          <span
                            onDoubleClick={(e) => {
                              setEditInputIndex(index);
                              setEditInputValue(tag);
                              e.preventDefault();
                            }}
                          >
                            {isLongTag ? `${tag.slice(0, 20)}...` : tag}
                          </span>
                        </Tag>
                      );
                      return isLongTag ? (
                        <Tooltip title={tag} key={tag}>
                          {tagElem}
                        </Tooltip>
                      ) : (
                        tagElem
                      );
                    })}
                  </Space>
                  {inputVisible ? (
                    <AutoComplete
                      options={options}
                      onSelect={onSelect}
                      onSearch={(text) => setOptions(search(text))}
                      value={inputValue}
                      onChange={(value) => handleAutocompleteChange(value)}
                      onBlur={() => handleInputConfirm()}
                    >
                      <Input
                        ref={inputRef}
                        type="text"
                        size="small"
                        style={tagInputStyle}
                        onPressEnter={() => handleInputConfirm()}
                      />
                    </AutoComplete>
                  ) : (
                    <Tag style={tagPlusStyle} onClick={() => showInput()}>
                      <PlusOutlined /> New Tag
                    </Tag>
                  )}
                </Space>
              </Form.Item>
            </Panel>
            <Panel header={<PanelHeader title="Function Arguments" />} key="2" forceRender>
              <Form.Item
                label="Arguments"
                name="arguments"
              >
                <JsonSchemaEditor />
              </Form.Item>
            </Panel>
            <Panel header={<PanelHeader title="Function Return" />} key="3" forceRender>
              <Form.Item
                label="Return Type"
                name="returnType"
                wrapperCol={{ span: 6 }}
              >
                <Select options={returnTypeOptions} />
              </Form.Item>
              {returnTypeValue === 'application/json' ?
                <Form.Item
                  label="Return Schema"
                  name="returnTypeSchema"
                >
                  <JsonSchemaEditor />
                </Form.Item>
                : null
              }
            </Panel>
            <Panel header={<PanelHeader title="Model Implementations" />} key="4" forceRender>
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
                          {getModel(index)?.type === 'api' ?
                            <Form.Item
                              name={[field.name, 'url']}
                              label="URL"
                              labelCol={{ span: 24 }}
                              wrapperCol={{ span: 24 }}
                            >
                              <Input />
                            </Form.Item>
                            : null
                          }
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
                            <Radio.Group onChange={handleTabChange} value={activeTab} style={{ marginBottom: 8 }}>
                              <Radio.Button value="1">Simple</Radio.Button>
                              <Radio.Button value="2">Advanced</Radio.Button>
                            </Radio.Group>
                            <Tabs
                              activeKey={activeTab}
                              style={{ marginBottom: 24 }}
                              items={[
                                {
                                  key: '1',
                                  children: isSimpleArgumentMappingEnabled(index) ?
                                    <Form.Item
                                      colon={false}
                                      name={[field.name, 'mappingData']}
                                      wrapperCol={{ span: 24 }}
                                      initialValue={[]}
                                      valuePropName="mappingData"
                                      getValueFromEvent={(args) => {
                                        return args.mappingData;
                                      }}
                                    >
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
                                      />
                                    </Form.Item>
                                    :
                                    <div>Not available. Use Advanced.</div>
                                },
                                {
                                  key: '2',
                                  children: isAdvancedArgumentMappingEnabled(index) ?
                                    <Form.Item
                                      colon={false}
                                      name={[field.name, 'mappingTemplate']}
                                      wrapperCol={{ span: 24 }}
                                      initialValue={''}
                                      getValueFromEvent={(args) => {
                                        // console.log('args:', args);
                                        return args;
                                      }}
                                    >
                                      <MonacoEditor
                                        height={250}
                                        language="javascript"
                                        theme={isDarkMode ? 'vs-dark' : 'vs-light'}
                                        options={monacoOptions}
                                      />
                                    </Form.Item>
                                    :
                                    <div>Not available.</div>
                                },
                              ]}
                            />
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
                            <Radio.Group onChange={handleReturnTabChange} value={activeReturnTab} style={{ marginBottom: 8 }}>
                              <Radio.Button value="1">Predefined</Radio.Button>
                              <Radio.Button value="2">Simple</Radio.Button>
                              <Radio.Button value="3">Advanced</Radio.Button>
                            </Radio.Group>
                            <Tabs
                              activeKey={activeReturnTab}
                              items={[
                                {
                                  key: '1',
                                  children: isModelGptType(index) ?
                                    <Form.Item
                                      name={[field.name, 'returnTransformation']}
                                      wrapperCol={{ span: 12 }}
                                    >
                                      <Select allowClear options={transformationOptions} />
                                    </Form.Item>
                                    :
                                    <div>Not available.</div>
                                },
                                {
                                  key: '2',
                                  children: isSimpleReturnTypeMappingEnabled(index) ?
                                    <Form.Item
                                      colon={false}
                                      name={[field.name, 'returnMappingData']}
                                      wrapperCol={{ span: 24 }}
                                      initialValue={[]}
                                      valuePropName="mappingData"
                                      getValueFromEvent={(args) => {
                                        return args.mappingData;
                                      }}
                                    >
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
                                      />
                                    </Form.Item>
                                    :
                                    <div>Not available. Use Advanced.</div>
                                },
                                {
                                  key: '3',
                                  children: isAdvancedReturnTypeMappingEnabled(index) ?
                                    <Form.Item
                                      colon={false}
                                      name={[field.name, 'returnMappingTemplate']}
                                      wrapperCol={{ span: 24 }}
                                      initialValue={''}
                                      getValueFromEvent={(args) => {
                                        console.log('args:', args);
                                        return args;
                                      }}
                                    >
                                      <MonacoEditor
                                        height={250}
                                        language="javascript"
                                        theme={isDarkMode ? 'vs-dark' : 'vs-light'}
                                        options={monacoOptions}
                                      />
                                    </Form.Item>
                                    :
                                    <div>Not available.</div>
                                },
                              ]}
                            />
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
            </Panel>
          </Collapse>
          <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
            <Space>
              <Button type="default" onClick={onCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save</Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
    </>
  );
}