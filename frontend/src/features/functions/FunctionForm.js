import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
} from 'antd';
import { CloseOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import ReactJson from 'react-json-view';
import isEmpty from 'lodash.isempty';
import * as dayjs from 'dayjs';

import { ExperimentsModalInput } from '../../components/ExperimentsModalInput';
import { MappingModalInput } from '../../components/MappingModalInput';
import { SchemaModalInput } from '../../components/SchemaModalInput';
import { TagsInput } from '../../components/TagsInput';
import NavbarContext from '../../contexts/NavbarContext';
import UserContext from '../../contexts/UserContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getDataSourcesAsync,
  selectDataSources,
  selectLoading as selectDataSourcesLoading,
} from '../dataSources/dataSourcesSlice';
import {
  getIndexesAsync,
  selectIndexes,
  selectLoading as selectIndexesLoading,
} from '../indexes/indexesSlice';
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
  getGuardrailsAsync,
  selectLoading as selectGuardrailsLoading,
  selectGuardrails,
} from './guardrailsSlice';
import {
  getOutputParsersAsync,
  selectLoading as selectOutputParsersLoading,
  selectOutputParsers,
} from './outputParsersSlice';

import 'react-data-mapping/dist/index.css';

const { TextArea } = Input;
const { Option } = Select;

const TAGS_KEY = 'functionTags';
const TIME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

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

export function FunctionForm() {

  const [existingTags, setExistingTags] = useState([]);
  const [formData, setFormData] = useState(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedImplementation, setSelectedImplementation] = useState(-1);

  const dataSources = useSelector(selectDataSources);
  const dataSourcesLoading = useSelector(selectDataSourcesLoading);
  const functions = useSelector(selectFunctions);
  const guardrails = useSelector(selectGuardrails);
  const guardrailsLoading = useSelector(selectGuardrailsLoading);
  const indexes = useSelector(selectIndexes);
  const indexesLoading = useSelector(selectIndexesLoading);
  const loaded = useSelector(selectLoaded);
  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);
  const outputParsers = useSelector(selectOutputParsers);
  const outputParsersLoading = useSelector(selectOutputParsersLoading);
  const promptSets = useSelector(selectPromptSets);
  const promptSetsLoaded = useSelector(selectPromptSetsLoaded);
  const settings = useSelector(selectSettings);
  const testResult = useSelector(selectTestResult);
  const testResultLoaded = useSelector(selectTestResultLoaded);
  const testResultLoading = useSelector(selectTestResultLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { currentUser } = useContext(UserContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();

  const functionArgsSchema = Form.useWatch('arguments', form);
  const implementationsValue = Form.useWatch('implementations', form);
  const returnTypeValue = Form.useWatch('returnType', form);
  const functionReturnTypeSchema = Form.useWatch('returnTypeSchema', form);

  const id = location.pathname.match(/\/functions\/(.*)/)[1];
  const func = functions[id];
  const isNew = id === 'new';

  const uiSchema = {
    "ui:submitButtonOptions": {
      "props": {
        "loading": testResultLoading,
        "type": "primary",
      },
      "submitText": "Run",
    },
  };

  const featureStoreOptions = useMemo(() => {
    const list = Object.values(dataSources)
      .filter((ds) => ds.type === 'featurestore')
      .map((ds) => ({
        label: ds.name,
        value: ds.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [dataSources]);

  const inputGuardrailOptions = useMemo(() => {
    const list = guardrails
      .filter((g) => g.type === 'input')
      .map((g) => ({
        label: g.name,
        value: g.key,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [guardrails]);

  const indexOptions = useMemo(() => {
    const list = Object.values(indexes)
      .map((idx) => ({
        label: idx.name,
        value: idx.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [indexes]);

  const outputGuardrailOptions = useMemo(() => {
    const list = guardrails
      .filter((g) => g.type === 'output')
      .map((g) => ({
        label: g.name,
        value: g.key,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [guardrails]);

  const modelOptions = useMemo(() => {
    const list = Object.values(models)
      .map((m) => ({
        label: m.name,
        value: m.id,
        disabled: !!m.disabled,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [models]);

  const outputParserOptions = useMemo(() => {
    const list = Object.values(outputParsers).map((p) => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [outputParsers]);

  const promptSetOptions = useMemo(() => {
    const list = Object.values(promptSets).map((s) => ({
      label: s.name,
      value: s.id,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [promptSets]);

  const promptSetVersionOptions = (index) => {
    const promptSetId = implementationsValue[index].promptSetId;
    if (promptSetId) {
      const promptSet = promptSets[promptSetId];
      const versions = promptSet.versions || [];
      const list = versions.map((v) => ({
        label: v.title,
        value: v.id,
        created: v.created,
      }));
      list.sort((a, b) => a.label < b.label ? -1 : 1);
      return list;
    }
    return [];
  };

  const sqlSourceOptions = useMemo(() => {
    const list = Object.values(dataSources)
      .filter((ds) => ds.type === 'sql')
      .map((ds) => ({
        label: ds.name,
        value: ds.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [dataSources]);

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
    dispatch(getGuardrailsAsync());
    dispatch(getOutputParsersAsync());
    if (!isNew) {
      dispatch(getFunctionAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getIndexesAsync({ workspaceId }));
      dispatch(getDataSourcesAsync({ workspaceId }));
      dispatch(getModelsAsync({ workspaceId }));
      dispatch(getPromptSetsAsync({ workspaceId }));
      dispatch(getSettingAsync({ key: TAGS_KEY, workspaceId }));
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
          workspaceId: selectedWorkspace.id,
        },
      }));
    } else {
      // console.log('values:', values);
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
    // console.log('settings:', settings);
    const setting = settings[TAGS_KEY];
    // console.log('setting:', setting, TAGS_KEY);
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

  const getModel = (index) => {
    if (!(implementationsValue && modelsLoaded)) return null;
    const impl = implementationsValue[index];
    if (!impl) return null;
    const id = impl.modelId;
    if (!id) return null;
    return models[id];
  };

  const getModelArgsSchema = (index) => {
    const model = getModel(index);
    if (!model) return null;
    if (model.type === 'gpt') {
      const promptSet = getPromptSet(index);
      if (!promptSet) return null;
      return promptSet.arguments;
    }
    return model.arguments;
  };

  const getModelReturnTypeSchema = (index) => {
    const model = getModel(index);
    if (!model) return null;
    return model.returnTypeSchema;
  };

  const isModelApiType = (index) => {
    return getModel(index)?.type === 'api';
  };

  const getPromptSet = (index) => {
    if (!(implementationsValue && promptSetsLoaded)) return null;
    const impl = implementationsValue[index];
    if (!impl) return null;
    const id = impl.promptSetId;
    if (!id) return null;
    return promptSets[id];
  };

  const runTest = async ({ formData }) => {
    const impl = func.implementations[selectedImplementation];
    if (impl) {
      dispatch(runTestAsync({
        args: formData,
        modelId: impl.modelId,
        name: func.name,
        workspaceId: selectedWorkspace.id,
      }));
    }
  };

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
                <div>{String(testResult.choices[0].message.content)}</div>
              }
            </div>
            : null
          }
        </Modal>
        : null
      }
      <div id="function-form" style={{ marginTop: 20 }}>
        <Form
          {...layout}
          form={form}
          name="function"
          autoComplete="off"
          onFinish={onFinish}
          initialValues={func}
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[
              {
                required: true,
                message: 'Please enter a function name',
              },
            ]}
            wrapperCol={{ span: 12 }}
          >
            <Input style={{ minWidth: 437 }} />
          </Form.Item>
          <Form.Item
            label="Description"
            name="description"
            wrapperCol={{ span: 12 }}
          >
            <TextArea autoSize={{ minRows: 1, maxRows: 14 }} style={{ minWidth: 437 }} />
          </Form.Item>
          {currentUser?.roles?.includes('admin') ?
            <Form.Item
              label="Public"
            >
              <Form.Item
                name="isPublic"
                valuePropName="checked"
                style={{ display: 'inline-block', margin: 0 }}
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label="Tags"
                name="tags"
                style={{ display: 'inline-block', margin: '0 24px' }}
              >
                <TagsInput existingTags={existingTags} />
              </Form.Item>
            </Form.Item>
            :
            <Form.Item
              label="Tags"
              name="tags"
            >
              <TagsInput existingTags={existingTags} />
            </Form.Item>
          }
          <Form.Item
            label="Arguments"
          >
            <Form.Item
              name="arguments"
              style={{ display: 'inline-block', margin: 0 }}
            >
              <SchemaModalInput />
            </Form.Item>
            <Form.Item
              label="Return Type"
              style={{ display: 'inline-block', margin: '0 16px' }}
            >
              <Form.Item
                name="returnType"
                style={{ display: 'inline-block', margin: 0, width: 200 }}
              >
                <Select options={returnTypeOptions} optionFilterProp="label" />
              </Form.Item>
              {returnTypeValue === 'application/json' ?
                <Form.Item
                  name="returnTypeSchema"
                  style={{ display: 'inline-block', margin: '0 8px' }}
                >
                  <SchemaModalInput />
                </Form.Item>
                : null
              }
            </Form.Item>
          </Form.Item>
          <Form.Item
            label="Experiments"
            name="experiments"
          >
            <ExperimentsModalInput
              implementationsValue={implementationsValue}
              models={models}
            />
          </Form.Item>
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
                      <div style={{ display: 'flex' }}>
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
                          style={{ flex: 1 }}
                        >
                          <Select options={modelOptions} optionFilterProp="label" />
                        </Form.Item>
                        {implementationsValue?.[index]?.modelId ?
                          <Button
                            type="link"
                            icon={<LinkOutlined />}
                            onClick={() => navigate(`/models/${implementationsValue?.[index]?.modelId}`)}
                            style={{ marginTop: 32, width: 32 }}
                          />
                          : null
                        }
                      </div>
                      {getModel(index)?.type === 'gpt' ?
                        <>
                          <div style={{ display: 'flex' }}>
                            <Form.Item
                              name={[field.name, 'promptSetId']}
                              label="Prompt Template"
                              labelCol={{ span: 24 }}
                              wrapperCol={{ span: 24 }}
                              style={{ flex: 1 }}
                            >
                              <Select
                                allowClear
                                options={promptSetOptions}
                                optionFilterProp="label"
                              />
                            </Form.Item>
                            {implementationsValue?.[index]?.promptSetId ?
                              <Button
                                type="link"
                                icon={<LinkOutlined />}
                                onClick={() => navigate(`/prompt-sets/${implementationsValue?.[index]?.promptSetId}`)}
                                style={{ marginTop: 32, width: 32 }}
                              />
                              : null
                            }
                          </div>
                          <Form.Item
                            name={[field.name, 'promptSetVersion']}
                            label="Template Version"
                            labelCol={{ span: 24 }}
                            wrapperCol={{ span: 24 }}
                          >
                            <Select
                              allowClear
                              optionFilterProp="label"
                              placeholder="latest"
                            >
                              {promptSetVersionOptions(index).map(v => (
                                <Option key={v.value} value={v.value} label={v.label}>
                                  <div>{v.label}</div>
                                  <div
                                    className="text-secondary"
                                    style={{ marginTop: 5 }}
                                  >
                                    {dayjs(v.created).format(TIME_FORMAT)}
                                  </div>
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </>
                        : null
                      }
                      <div>
                        <label style={{
                          alignItems: 'center',
                          display: 'inline-flex',
                          height: 32,
                          lineHeight: '22px',
                          whiteSpace: 'nowrap',
                        }}>
                          Argument Mapping
                        </label>
                      </div>
                      <Form.Item
                        colon={false}
                        name={[field.name, 'mappingData']}
                        wrapperCol={{ span: 24 }}
                        initialValue={''}
                      >
                        <MappingModalInput
                          sourceSchema={functionArgsSchema}
                          targetSchema={getModelArgsSchema(index)}
                          disabledMessage="Have both function and model or prompt arguments been defined?"
                          sourceTitle="Request Arguments"
                          targetTitle={isModelApiType(index) ? 'Model Arguments' : 'Prompt Arguments'}
                        />
                      </Form.Item>
                      <div>
                        <label style={{
                          alignItems: 'center',
                          display: 'inline-flex',
                          height: 32,
                          lineHeight: '22px',
                          whiteSpace: 'nowrap',
                        }}>
                          Return Type Mapping
                        </label>
                      </div>
                      <Form.Item
                        colon={false}
                        name={[field.name, 'returnMappingData']}
                        wrapperCol={{ span: 24 }}
                        initialValue={''}
                      >
                        <MappingModalInput
                          sourceSchema={getModelReturnTypeSchema(index)}
                          targetSchema={functionReturnTypeSchema}
                          disabledMessage="Have both model and function return types been defined?"
                          sourceTitle="Model Return"
                          targetTitle="Function Return"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6} style={{
                      border: '1px solid #d9d9d9',
                      borderRightRadius: '6px',
                      borderLeft: 'none',
                      borderRight: 'none',
                      overflowX: 'visible',
                      padding: '8px 20px',
                    }}>
                      <Divider orientation="left" plain style={{ height: 32, marginTop: 0 }}>
                        Knowledge Doping
                      </Divider>
                      <div style={{ display: 'flex' }}>
                        <Form.Item
                          colon={false}
                          name={[field.name, 'dataSourceId']}
                          label="Online Feature Store"
                          extra="Inject Features"
                          labelCol={{ span: 24 }}
                          wrapperCol={{ span: 24 }}
                          style={{ flex: 1, marginTop: '-16px' }}
                        >
                          <Select allowClear
                            loading={dataSourcesLoading}
                            options={featureStoreOptions}
                            optionFilterProp="label"
                            placeholder="Select feature store"
                          />
                        </Form.Item>
                        {implementationsValue?.[index]?.dataSourceId ?
                          <Button
                            type="link"
                            icon={<LinkOutlined />}
                            onClick={() => navigate(`/data-sources/${implementationsValue?.[index]?.dataSourceId}`)}
                            style={{ marginTop: 16, width: 32 }}
                          />
                          : null
                        }
                      </div>
                      <div style={{ display: 'flex' }}>
                        <Form.Item
                          colon={false}
                          name={[field.name, 'sqlSourceId']}
                          label="SQL Data Source"
                          extra="Inject Metadata"
                          labelCol={{ span: 24 }}
                          wrapperCol={{ span: 24 }}
                          style={{ flex: 1 }}
                        >
                          <Select allowClear
                            loading={dataSourcesLoading}
                            options={sqlSourceOptions}
                            optionFilterProp="label"
                            placeholder="Select data source"
                          />
                        </Form.Item>
                        {implementationsValue?.[index]?.sqlSourceId ?
                          <Button
                            type="link"
                            icon={<LinkOutlined />}
                            onClick={() => navigate(`/data-sources/${implementationsValue?.[index]?.sqlSourceId}`)}
                            style={{ marginTop: 32, width: 32 }}
                          />
                          : null
                        }
                      </div>
                      <div>
                        <label style={{
                          alignItems: 'center',
                          display: 'inline-flex',
                          height: 32,
                          lineHeight: '22px',
                          whiteSpace: 'nowrap',
                        }}>
                          Semantic Indexes
                        </label>
                      </div>
                      <Form.List name={[field.name, 'indexes']}>
                        {(fields, { add, remove }, { errors }) => (
                          <>
                            {fields.map((field, idx) => (
                              <Row key={field.key} style={{
                                marginBottom: '8px',
                              }}>
                                <Col span={24}>
                                  <div style={{ display: 'flex' }}>
                                    <Form.Item
                                      name={[field.name, 'indexId']}
                                      labelCol={{ span: 24 }}
                                      wrapperCol={{ span: 24 }}
                                      style={{ flex: 1 }}
                                    >
                                      <Select allowClear
                                        loading={indexesLoading}
                                        options={indexOptions}
                                        optionFilterProp="label"
                                        placeholder="Select index"
                                      />
                                    </Form.Item>
                                    {implementationsValue?.[index]?.indexes?.[idx]?.indexId ?
                                      <Button
                                        type="link"
                                        icon={<LinkOutlined />}
                                        onClick={() => navigate(`/indexes/${implementationsValue?.[index]?.indexes?.[idx]?.indexId}`)}
                                        style={{ width: 32 }}
                                      />
                                      : null
                                    }
                                    {fields.length ?
                                      <Button type="text"
                                        icon={<CloseOutlined />}
                                        className="dynamic-delete-button"
                                        onClick={() => remove(field.name)}
                                        style={{ width: 32 }}
                                      />
                                      : null
                                    }
                                  </div>
                                  {implementationsValue?.[index]?.indexes?.[idx]?.indexId ?
                                    <>
                                      <Form.Item
                                        extra="Content path"
                                        initialValue="content"
                                        name={[field.name, 'indexContentPropertyPath']}
                                        placeholder="Content path"
                                        style={{ display: 'inline-block', width: 'calc(50% - 4px)' }}
                                        wrapperCol={{ span: 24 }}
                                      >
                                        <Input />
                                      </Form.Item>
                                      <Form.Item
                                        extra="Context path"
                                        initialValue="context"
                                        name={[field.name, 'indexContextPropertyPath']}
                                        placeholder="Context path"
                                        style={{ display: 'inline-block', width: 'calc(50% - 4px)', marginLeft: 8 }}
                                        wrapperCol={{ span: 24 }}
                                      >
                                        <Input />
                                      </Form.Item>
                                      <Form.Item
                                        extra="All"
                                        name={[field.name, 'allResults']}
                                        valuePropName="checked"
                                        style={{ display: 'inline-block', width: 'calc(50% - 4px)' }}
                                        wrapperCol={{ span: 24 }}
                                      >
                                        <Switch />
                                      </Form.Item>
                                      <Form.Item
                                        extra="Summarize"
                                        name={[field.name, 'summarizeResults']}
                                        valuePropName="checked"
                                        style={{ display: 'inline-block', width: 'calc(50% - 4px)', marginLeft: 8 }}
                                        wrapperCol={{ span: 24 }}
                                      >
                                        <Switch />
                                      </Form.Item>
                                    </>
                                    : null
                                  }
                                </Col>
                              </Row>
                            ))}
                            <Form.Item wrapperCol={{ span: 24 }}>
                              <Button
                                type="dashed"
                                onClick={() => add()}
                                style={{ width: '100%', zIndex: 101 }}
                                icon={<PlusOutlined />}
                              >
                                Add Index
                              </Button>
                              <Form.ErrorList errors={errors} />
                            </Form.Item>
                          </>
                        )}
                      </Form.List>
                    </Col>
                    <Col span={6} style={{
                      border: '1px solid #d9d9d9',
                      borderRightRadius: '6px',
                      borderLeft: 'none',
                      borderRight: 'none',
                      overflowX: 'auto',
                      padding: '8px 20px',
                    }}>
                      <Divider orientation="left" plain style={{ height: 32, marginTop: 0 }}>
                        Guardrails
                      </Divider>
                      <Form.Item
                        colon={false}
                        name={[field.name, 'inputGuardrails']}
                        label="Input Guardrails"
                        labelCol={{ span: 24 }}
                        wrapperCol={{ span: 24 }}
                        style={{ marginTop: '-16px' }}
                      >
                        <Select allowClear
                          mode="multiple"
                          loading={guardrailsLoading}
                          options={inputGuardrailOptions}
                          optionFilterProp="label"
                          placeholder="Select guardrails"
                        />
                      </Form.Item>
                      <Form.Item
                        colon={false}
                        name={[field.name, 'outputGuardrails']}
                        label="Output Guardrails"
                        labelCol={{ span: 24 }}
                        wrapperCol={{ span: 24 }}
                      >
                        <Select allowClear
                          mode="multiple"
                          loading={guardrailsLoading}
                          options={outputGuardrailOptions}
                          optionFilterProp="label"
                          placeholder="Select guardrails"
                        />
                      </Form.Item>
                      <Form.Item
                        colon={false}
                        name={[field.name, 'outputParser']}
                        label="Output Parser"
                        labelCol={{ span: 24 }}
                        wrapperCol={{ span: 24 }}
                      >
                        <Select allowClear
                          loading={outputParsersLoading}
                          options={outputParserOptions}
                          optionFilterProp="label"
                          placeholder="Select output parser"
                        />
                      </Form.Item>
                      <Divider orientation="left" plain style={{ height: 32, marginTop: 24 }}>
                        Options
                      </Divider>
                      <div style={{ display: 'flex', marginTop: '-8px' }}>
                        <Form.Item
                          extra="Default"
                          name={[field.name, 'isDefault']}
                          wrapperCol={{ span: 24 }}
                          valuePropName="checked"
                          initialValue={index === 0}
                        >
                          {/* <LabelledSwitch label="Default?" /> */}
                          <Switch />
                        </Form.Item>
                        <Form.Item
                          extra="Semantic Cache"
                          name={[field.name, 'cache']}
                          wrapperCol={{ span: 24 }}
                          valuePropName="checked"
                          style={{ marginLeft: 16 }}
                        >
                          <Switch />
                        </Form.Item>
                        {!isNew ?
                          <>
                            <div style={{ flex: 1 }}></div>
                            <Button type="primary" onClick={() => { handleTest(index); }}>Test</Button>
                          </>
                          : null
                        }
                      </div>
                    </Col>
                    <Col span={1} style={{
                      border: '1px solid #d9d9d9',
                      borderRightRadius: '6px',
                      borderLeft: 'none',
                      overflowX: 'auto',
                      padding: '8px 20px',
                    }}>

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
                <Form.Item wrapperCol={{ offset: 4, span: 19 }}>
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
