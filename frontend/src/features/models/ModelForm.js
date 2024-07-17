import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  DatePicker,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  Space,
  Switch,
} from 'antd';
import {
  BlockOutlined,
  CloseOutlined,
  DownloadOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import * as dayjs from 'dayjs';
import debounce from 'lodash.debounce';
import snakeCase from 'lodash.snakecase';
import { v4 as uuidv4 } from 'uuid';

import Download from '../../components/Download';
import { SchemaModalInput } from '../../components/SchemaModalInput';
import NavbarContext from '../../contexts/NavbarContext';
import UserContext from '../../contexts/UserContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  duplicateObjectAsync,
} from '../uploader/fileUploaderSlice';

import {
  getModelsAsync as getHfModelsAsync,
  selectModels as selectHfModels,
  selectLoading as selectHfModelsLoading,
} from './hfModelsSlice';
import {
  getChatProvidersAsync,
  getCompletionProvidersAsync,
  getEmbeddingProvidersAsync,
  getImageProvidersAsync,
  getRerankerProvidersAsync,
  selectLoading as selectProvidersLoading,
  selectProviders,
} from './modelProvidersSlice';
import {
  createModelAsync,
  getModelAsync,
  updateModelAsync,
  selectLoaded,
  selectModels,
} from './modelsSlice';

const { TextArea } = Input;

const layout = {
  labelCol: { span: 5 },
  wrapperCol: { span: 16 },
};

const subFieldLayout = {
  colon: false,
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
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

const typeOptions = [
  {
    label: 'LLM - Chat',
    value: 'gpt',
  },
  {
    label: 'LLM - Text',
    value: 'completion',
    disabled: false,
  },
  {
    label: 'LLM - Embedding',
    value: 'embedding',
  },
  {
    label: 'LLM - Reranker',
    value: 'reranker',
  },
  {
    label: 'Image Generation',
    value: 'imagegen',
  },
  {
    label: 'Hugging Face',
    value: 'huggingface',
  },
  {
    label: 'Custom',
    value: 'api',
  },
];

export function ModelForm() {

  const [backOnSave, setBackOnSave] = useState(false);
  const [correlationId, setCorrelationId] = useState(null);

  const loaded = useSelector(selectLoaded);
  const models = useSelector(selectModels);
  const providers = useSelector(selectProviders);
  const providersLoading = useSelector(selectProvidersLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { currentUser } = useContext(UserContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();

  const typeValue = Form.useWatch('type', form);
  const typesDefinedValue = Form.useWatch('isTypesDefined', form);
  const returnTypeValue = Form.useWatch('returnType', form);
  const costsValue = Form.useWatch('costs', form);

  const id = location.pathname.match(/\/models\/(.*?)\/edit/)[1];
  const isNew = id === 'new';

  const model = useMemo(() => {
    const mdl = models[id];
    if (mdl) {
      let trainingDate;
      if (mdl.trainingDate) {
        trainingDate = dayjs(mdl.trainingDate);
      }
      return {
        ...mdl,
        trainingDate,
      };
    }
  }, [id, models]);

  // console.log('model:', model);

  const chatProviderOptions = useMemo(() => {
    const list = (providers.chat || []).map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [providers]);

  const completionProviderOptions = useMemo(() => {
    const list = (providers.completion || []).map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [providers]);

  const embeddingProviderOptions = useMemo(() => {
    const list = (providers.embedding || []).map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [providers]);

  const rerankerProviderOptions = useMemo(() => {
    const list = (providers.reranker || []).map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [providers]);

  const imageProviderOptions = useMemo(() => {
    const list = (providers.imagegen || []).map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [providers]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Model',
    }));
    if (!isNew) {
      dispatch(getModelAsync(id));
    }
  }, []);

  useEffect(() => {
    if (!providers.chat && (typeValue === 'gpt')) {
      dispatch(getChatProvidersAsync());
    } else if (!providers.completion && typeValue === 'completion') {
      dispatch(getCompletionProvidersAsync());
    } else if (!providers.embedding && typeValue === 'embedding') {
      dispatch(getEmbeddingProvidersAsync());
    } else if (!providers.reranker && typeValue === 'reranker') {
      dispatch(getRerankerProvidersAsync());
    } else if (!providers.imagegen && typeValue === 'imagegen') {
      dispatch(getImageProvidersAsync());
    }
  }, [typeValue]);

  useEffect(() => {
    if (backOnSave) {
      setBackOnSave(false);
      navigate('/models');
    }
    if (correlationId) {
      const model = Object.values(models).find(m => m.correlationId === correlationId);
      if (model) {
        navigate(`/models/${model.id}/edit`);
        setCorrelationId(null);
      }
    }
  }, [models]);

  const handleDuplicate = async () => {
    const correlationId = uuidv4();
    const values = await form.validateFields();
    const obj = { ...model, ...values };
    dispatch(duplicateObjectAsync({
      correlationId,
      obj,
      type: 'model',
      workspaceId: selectedWorkspace.id,
    }));
    setCorrelationId(correlationId);
  };

  const onCancel = () => {
    navigate('/models');
  };

  const onFinish = (values) => {
    if (isNew) {
      dispatch(createModelAsync({
        values: {
          ...values,
          workspaceId: selectedWorkspace.id,
        },
      }));
    } else {
      dispatch(updateModelAsync({
        id,
        values: {
          ...model,
          ...values,
        },
      }));
    }
    setBackOnSave(true);
  };

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <div style={{ marginTop: 20 }}>
      <Form
        {...layout}
        form={form}
        name="model"
        autoComplete="off"
        onFinish={onFinish}
        initialValues={model}
      >
        <Form.Item wrapperCol={{ span: 21 }}>
          <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 16, alignItems: 'center' }}>
            {!isNew ?
              <>
                <Dropdown arrow
                  className="action-link"
                  placement="bottom"
                  menu={{
                    items: [
                      {
                        key: 'duplicate',
                        icon: <BlockOutlined />,
                        label: (
                          <Link onClick={handleDuplicate}>Duplicate</Link>
                        ),
                      },
                      {
                        key: 'download',
                        icon: <DownloadOutlined />,
                        label: (
                          <Download filename={snakeCase(model?.name) + '.json'} payload={model}>
                            <Link>Export</Link>
                          </Download>
                        )
                      },
                    ]
                  }}
                >
                  <MoreOutlined />
                </Dropdown>
                <Link to={`/models/${id}`}>View</Link>
              </>
              : null
            }
            <Link to={`/models`}>List</Link>
          </div>
        </Form.Item>
        <Form.Item
          label="Name"
          name="name"
          rules={[
            {
              required: true,
              message: 'Please enter a model name',
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Key"
          name="key"
          rules={[
            {
              required: true,
              message: 'Please enter a key',
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
          label="Disabled"
        >
          <Form.Item
            name="disabled"
            valuePropName="checked"
            style={{ display: 'inline-block', margin: 0 }}
          >
            <Switch />
          </Form.Item>
          {currentUser?.roles?.includes('admin') ?
            <Form.Item
              label="Public"
              name="isPublic"
              valuePropName="checked"
              style={{ display: 'inline-block', margin: '0 16px' }}
            >
              <Switch />
            </Form.Item>
            : null
          }
        </Form.Item>
        <Form.Item
          label="Type"
        >
          <Form.Item
            name="type"
            style={{ display: 'inline-block', width: 'calc(50% - 96px)', marginBottom: 0 }}
          >
            <Select options={typeOptions} optionFilterProp="label" />
          </Form.Item>
          {typeValue === 'embedding' ?
            <>
              <Form.Item
                label="Provider"
                name="provider"
                style={{ display: 'inline-block', width: 'calc(50% - 105px)', marginBottom: 0, marginLeft: 16 }}
              >
                <Select
                  loading={providersLoading}
                  options={embeddingProviderOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item
                name="outputDim"
                label="Output dim"
                style={{ display: 'inline-block', marginBottom: 0, marginLeft: 8 }}
              >
                <InputNumber />
              </Form.Item>
            </>
            : null
          }
          {typeValue === 'gpt' ?
            <Form.Item
              label="Provider"
              name="provider"
              style={{ display: 'inline-block', width: 'calc(50% - 20px)', marginBottom: 0, marginLeft: 16 }}
            >
              <Select
                loading={providersLoading}
                options={chatProviderOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            : null
          }
          {typeValue === 'completion' ?
            <Form.Item
              label="Provider"
              name="provider"
              style={{ display: 'inline-block', width: 'calc(50% - 20px)', marginBottom: 0, marginLeft: 16 }}
            >
              <Select
                loading={providersLoading}
                options={completionProviderOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            : null
          }
          {typeValue === 'reranker' ?
            <Form.Item
              label="Provider"
              name="provider"
              style={{ display: 'inline-block', width: 'calc(50% - 20px)', marginBottom: 0, marginLeft: 16 }}
            >
              <Select
                loading={providersLoading}
                options={rerankerProviderOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            : null
          }
          {typeValue === 'imagegen' ?
            <Form.Item
              label="Provider"
              name="provider"
              style={{ display: 'inline-block', width: 'calc(50% - 20px)', marginBottom: 0, marginLeft: 16 }}
            >
              <Select
                loading={providersLoading}
                options={imageProviderOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            : null
          }
        </Form.Item>
        <Form.Item
          name="multimodal"
          label="Multimodal"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name="trainingDate"
          label="Training Date"
        >
          <DatePicker picker="month" />
        </Form.Item>
        {typeValue === 'gpt' || typeValue === 'completion' || typeValue === 'imagegen' ?
          <Form.Item
            className="form-table"
            label="Inference Limits"
          >
            <Form.Item
              {...subFieldLayout}
              name="contextWindow"
              label="Context window"
              style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0 }}
            >
              <InputNumber />
            </Form.Item>
            {typeValue === 'gpt' || typeValue === 'completion' ?
              <>
                <Form.Item
                  {...subFieldLayout}
                  name="maxOutputTokens"
                  label="Max output tokens"
                  style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0, marginLeft: 8 }}
                >
                  <InputNumber />
                </Form.Item>
                <Form.Item
                  {...subFieldLayout}
                  name="tokensPerMinute"
                  label="Tokens / min"
                  style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0, marginLeft: 8 }}
                >
                  <InputNumber />
                </Form.Item>
                <Form.Item
                  {...subFieldLayout}
                  name="requestsPerMinute"
                  label="Requests / min"
                  style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0, marginLeft: 8 }}
                >
                  <InputNumber />
                </Form.Item>
              </>
              : null
            }
          </Form.Item>
          : null
        }
        {['gpt', 'completion', 'imagegen', 'embedding', 'reranker'].includes(typeValue) ?
          <>
            <Form.Item
              label="Price Currency"
              name="currency"
              initialValue={'USD'}
            >
              <Select
                options={[
                  {
                    label: 'USD',
                    value: 'USD',
                  },
                  {
                    label: 'EUR',
                    value: 'EUR'
                  },
                  {
                    label: 'GBP',
                    value: 'GBP'
                  },
                  {
                    label: 'AUD',
                    value: 'AUD'
                  },
                ]}
                style={{ width: 'calc(50% - 96px)' }}
              />
            </Form.Item>
            <Form.Item
              className="form-table"
              label="Cost Elements"
            >
              <Form.List name="costs">
                {(fields, { add, remove }, { errors }) => (
                  <>
                    {fields.map((field, index) => (
                      <Form.Item key={field.name}
                      >
                        <Form.Item
                          {...subFieldLayout}
                          label={index === 0 ? 'Type' : ''}
                          name={[field.name, 'type']}
                          style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0 }}
                          initialValue={'text'}
                        >
                          <Segmented
                            size="small"
                            style={{ background: 'rgba(0, 0, 0, 0.25)' }}
                            options={[
                              {
                                label: 'Text',
                                value: 'text'
                              },
                              {
                                label: 'Image',
                                value: 'image'
                              },
                              {
                                label: 'Multimodal',
                                value: 'multimodal'
                              },
                            ]}
                          />
                        </Form.Item>
                        <Form.Item
                          {...subFieldLayout}
                          label={index === 0 ? 'Mode' : ''}
                          name={[field.name, 'mode']}
                          style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0, marginLeft: 8 }}
                          initialValue={'online'}
                        >
                          <Segmented
                            size="small"
                            style={{ background: 'rgba(0, 0, 0, 0.25)' }}
                            options={[
                              {
                                label: 'Online',
                                value: 'online'
                              },
                              {
                                label: 'Batch',
                                value: 'batch'
                              },
                            ]}
                          />
                        </Form.Item>
                        {costsValue?.[index]?.type === 'text' || costsValue?.[index]?.type === 'multimodal' ? (
                          typeValue === 'reranker' ?
                            <Form.Item
                              {...subFieldLayout}
                              label={index === 0 ? 'Per 1k searches' : ''}
                              name={[field.name, 'per1kSearches']}
                              style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0, marginLeft: 8 }}
                            >
                              <InputNumber />
                            </Form.Item>
                            :
                            <>
                              <Form.Item
                                {...subFieldLayout}
                                label={index === 0 ? 'Input / 1k tok' : ''}
                                name={[field.name, 'inputPer1kTokens']}
                                style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0, marginLeft: 8 }}
                              >
                                <InputNumber />
                              </Form.Item>
                              <Form.Item
                                {...subFieldLayout}
                                label={index === 0 ? 'Output / 1k tok' : ''}
                                name={[field.name, 'outputPer1kTokens']}
                                style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0, marginLeft: 8 }}
                              >
                                <InputNumber />
                              </Form.Item>
                              {costsValue?.[index]?.type === 'multimodal' ?
                                <>
                                  <Form.Item
                                    style={{ display: 'inline-block', width: 'calc(50% - 20px)', marginBottom: 0, marginTop: 5 }}
                                  >
                                  </Form.Item>
                                  <Form.Item
                                    {...subFieldLayout}
                                    label={index === 0 ? 'Per input image' : ''}
                                    name={[field.name, 'perInputImage']}
                                    style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0, marginLeft: 8, marginTop: 5 }}
                                  >
                                    <InputNumber />
                                  </Form.Item>
                                  <Form.Item
                                    {...subFieldLayout}
                                    label={index === 0 ? 'Video / second' : ''}
                                    name={[field.name, 'videoPerSecond']}
                                    style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0, marginLeft: 8, marginTop: 5 }}
                                  >
                                    <InputNumber />
                                  </Form.Item>
                                </>
                                : null
                              }
                            </>
                        ) : null
                        }
                        {costsValue?.[index]?.type === 'image' ?
                          <Form.Item
                            {...subFieldLayout}
                            label={index === 0 ? 'Image Quality' : ''}
                            name={[field.name, 'imageQuality']}
                            style={{ display: 'inline-block', width: 'calc(50% - 20px)', marginLeft: 8 }}
                            initialValue={'standard'}
                          >
                            <Segmented
                              size="small"
                              style={{ background: 'rgba(0, 0, 0, 0.25)' }}
                              options={[
                                {
                                  label: 'Standard',
                                  value: 'standard'
                                },
                                {
                                  label: 'HD',
                                  value: 'HD'
                                },
                              ]}
                            />
                          </Form.Item>
                          : null
                        }
                        <Form.Item
                          {...subFieldLayout}
                          label={index === 0 ? ' ' : ''}
                          style={{ display: 'inline-block', width: '32px', marginBottom: 0 }}
                        >
                          <Button type="text"
                            icon={<CloseOutlined />}
                            className="dynamic-delete-button"
                            onClick={() => remove(field.name)}
                          />
                        </Form.Item>
                        {costsValue?.[index]?.type === 'image' ?
                          <Form.List
                            name={[field.name, 'imageBreakpoints']}
                          >
                            {(fields, { add, remove }, { errors }) => (
                              <>
                                {fields.map((field, index) => (
                                  <Form.Item key={field.name}
                                  >
                                    <Form.Item
                                      {...subFieldLayout}
                                      label={index === 0 ? 'Dim' : ''}
                                      name={[field.name, 'dim']}
                                      style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0 }}
                                    >
                                      <InputNumber />
                                    </Form.Item>
                                    <Form.Item
                                      {...subFieldLayout}
                                      label={index === 0 ? 'Price' : ''}
                                      name={[field.name, 'price']}
                                      style={{ display: 'inline-block', width: 'calc(25% - 14px)', marginBottom: 0, marginLeft: 8 }}
                                    >
                                      <InputNumber />
                                    </Form.Item>
                                    <Form.Item
                                      {...subFieldLayout}
                                      label={index === 0 ? ' ' : ''}
                                      style={{ display: 'inline-block', width: '32px', marginBottom: 0 }}
                                    >
                                      <Button type="text"
                                        icon={<CloseOutlined />}
                                        className="dynamic-delete-button"
                                        onClick={() => remove(field.name)}
                                      />
                                    </Form.Item>
                                  </Form.Item>
                                ))}
                                <Form.Item
                                  style={{ marginBottom: 0 }}
                                >
                                  <Button
                                    type="dashed"
                                    onClick={() => add()}
                                    style={{ width: 'calc(50% + 12px)', zIndex: 101 }}
                                    icon={<PlusOutlined />}
                                  >
                                    Add Breakpoint
                                  </Button>
                                  <Form.ErrorList errors={errors} />
                                </Form.Item>
                              </>
                            )}
                          </Form.List>
                          : null
                        }
                      </Form.Item>
                    ))}
                    <Form.Item
                      style={{ marginBottom: 0 }}
                    >
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        style={{ width: '100%', zIndex: 101 }}
                        icon={<PlusOutlined />}
                      >
                        Add Cost Element
                      </Button>
                      <Form.ErrorList errors={errors} />
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
          </>
          : null
        }
        {typeValue === 'api' ?
          <>
            <Form.Item
              name="url"
              label="URL"
              wrapperCol={{ span: 12 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="batchEndpoint"
              label="Batch Endpoint"
              wrapperCol={{ span: 12 }}
            >
              <Input />
            </Form.Item>
          </>
          : null
        }
        {/* {typeValue === 'huggingface' ?
          <Form.Item
            name="modelName"
            label="Model Name"
            wrapperCol={{ span: 12 }}
          >
            <Input />
          </Form.Item>
          : null
        } */}
        {/* </Panel> */}
        {typeValue === 'api' || typeValue === 'huggingface' ?
          <>
            <Form.Item
              colon={false}
              label="Schema"
              name="isTypesDefined"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            {typesDefinedValue ?
              <>
                <Form.Item
                  label="Arguments"
                  name="arguments"
                >
                  <SchemaModalInput />
                </Form.Item>
                <Form.Item
                  label="Return Type"
                  name="returnType"
                  wrapperCol={{ span: 12 }}
                >
                  <Select options={returnTypeOptions} optionFilterProp="label" />
                </Form.Item>
                {returnTypeValue === 'application/json' ?
                  <Form.Item
                    label="Return Type Schema"
                    name="returnTypeSchema"
                  >
                    <SchemaModalInput />
                  </Form.Item>
                  : null
                }
              </>
              : null
            }
          </>
          : null
        }
        {typeValue === 'huggingface' ?
          <>
            <Form.Item wrapperCol={{ offset: 4 }}>
              <div>** Requires elevated privileges for production grade endpoints, otherwise may take 20-30 minutes to prime. **</div>
            </Form.Item>
            <Form.Item
              label="Model Name"
              name="modelName"
            >
              <SearchInput
                style={{ display: 'inline-block', width: 'calc(50% - 88px)' }}
              />
            </Form.Item>
            <Form.Item
              label="Instance Type"
              name="instanceType"
            >
              <Select
                options={[]}
                optionFilterProp="label"
                style={{ display: 'inline-block', width: 'calc(50% - 88px)' }}
              />
            </Form.Item>
            <Form.Item
              label="Replica Autoscaling"
              wrapperCol={{ span: 6 }}
            >
              <Form.Item
                label="Min"
                colon={false}
                name="minScale"
                style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
              >
                <InputNumber />
              </Form.Item>
              <Form.Item
                label="Max"
                colon={false}
                name="maxScale"
                style={{ display: 'inline-block', width: 'calc(50% - 8px)', margin: '0 8px' }}
              >
                <InputNumber />
              </Form.Item>
            </Form.Item>
          </>
          : null
        }
        <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 5 }}>
          <Space>
            <Button type="default" onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}

function SearchInput({ onChange, value, style }) {

  const hfModels = useSelector(selectHfModels);
  const hfModelsLoading = useSelector(selectHfModelsLoading);

  const dispatch = useDispatch();

  const options = useMemo(() => Object.values(hfModels).map((m) => ({
    value: m.id,
    label: m.id,
  })), [hfModels]);

  const handleSearch = debounce((q) => {
    if (q.length > 2) {
      dispatch(getHfModelsAsync(q));
    }
  }, 1000);

  const handleChange = (value) => {
    console.log('value:', value);
    onChange(value);
  };

  return (
    <Select
      allowClear
      loading={hfModelsLoading}
      options={options}
      optionFilterProp="label"
      placeholder="Enter search query"
      showSearch
      defaultActiveFirstOption={false}
      filterOption={false}
      onSearch={handleSearch}
      onChange={handleChange}
      notFoundContent={null}
      value={value}
      style={style}
    />
  );
}
