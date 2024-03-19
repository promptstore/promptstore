import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, DatePicker, Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import * as dayjs from 'dayjs';
import debounce from 'lodash.debounce';
import snakeCase from 'lodash.snakecase';

import Download from '../../components/Download';
import { SchemaModalInput } from '../../components/SchemaModalInput';
import NavbarContext from '../../contexts/NavbarContext';
import UserContext from '../../contexts/UserContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getModelsAsync as getHfModelsAsync,
  selectModels as selectHfModels,
  selectLoading as selectHfModelsLoading,
} from './hfModelsSlice';
import {
  getChatProvidersAsync,
  getCompletionProvidersAsync,
  getEmbeddingProvidersAsync,
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
    label: 'Hugging Face',
    value: 'huggingface',
    disabled: true,
  },
  {
    label: 'Custom',
    value: 'api',
  },
];

export function ModelForm() {

  const [backOnSave, setBackOnSave] = useState(false);

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
    console.log('typeValue:', typeValue)
    if (!providers.chat && (typeValue === 'gpt')) {
      dispatch(getChatProvidersAsync());
    } else if (!providers.completion && typeValue === 'completion') {
      dispatch(getCompletionProvidersAsync());
    } else if (!providers.embedding && typeValue === 'embedding') {
      dispatch(getEmbeddingProvidersAsync());
    } else if (!providers.reranker && typeValue === 'reranker') {
      dispatch(getRerankerProvidersAsync());
    }
  }, [typeValue]);

  useEffect(() => {
    if (backOnSave) {
      setBackOnSave(false);
      navigate('/models');
    }
  }, [models]);

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
                <Download filename={snakeCase(model.name) + '.json'} payload={model}>
                  <Button type="text" icon={<DownloadOutlined />}>
                    Download
                  </Button>
                </Download>
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
          name="type"
          wrapperCol={{ span: 12 }}
        >
          <Select options={typeOptions} optionFilterProp="label" />
        </Form.Item>
        {typeValue === 'embedding' ?
          <>
            <Form.Item
              label="Provider"
              name="provider"
              wrapperCol={{ span: 12 }}
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
              wrapperCol={{ span: 4 }}
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
            wrapperCol={{ span: 12 }}
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
            wrapperCol={{ span: 12 }}
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
            wrapperCol={{ span: 12 }}
          >
            <Select
              loading={providersLoading}
              options={rerankerProviderOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          : null
        }
        {typeValue === 'gpt' || typeValue === 'completion' ?
          <>
            <Form.Item
              name="contextWindow"
              label="Context window"
              wrapperCol={{ span: 4 }}
            >
              <InputNumber />
            </Form.Item>
            <Form.Item
              name="maxOutputTokens"
              label="Max output tokens"
              wrapperCol={{ span: 4 }}
            >
              <InputNumber />
            </Form.Item>
            <Form.Item
              name="tokensPerMinute"
              label="Tokens per min."
              wrapperCol={{ span: 4 }}
            >
              <InputNumber />
            </Form.Item>
            <Form.Item
              name="requestsPerMinute"
              label="Requests per min."
              wrapperCol={{ span: 4 }}
            >
              <InputNumber />
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
              wrapperCol={{ span: 5 }}
            >
              <SearchInput />
            </Form.Item>
            <Form.Item
              label="Instance Type"
              name="instanceType"
              wrapperCol={{ span: 5 }}
            >
              <Select options={[]} optionFilterProp="label" />
            </Form.Item>
            <Form.Item
              label="Replica Autoscaling"
              wrapperCol={{ span: 5 }}
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
        <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
          <Space>
            <Button type="default" onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}

function SearchInput({ value, onChange }) {

  const hfModels = useSelector(selectHfModels);
  const hfModelsLoading = useSelector(selectHfModelsLoading);

  const dispatch = useDispatch();

  const options = useMemo(() => Object.values(hfModels).map((m) => ({
    key: m.id,
    label: m.id,
  })), [hfModels]);

  const handleSearch = debounce((q) => {
    if (q && q.length > 2) {
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
      showArrow={false}
      filterOption={false}
      onSearch={handleSearch}
      onChange={handleChange}
      notFoundContent={null}
      value={value}
    />
  )
}
