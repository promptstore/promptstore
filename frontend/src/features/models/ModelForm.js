import { useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Collapse, Form, Input, Select, Space, Switch } from 'antd';
import debounce from 'lodash.debounce';

import { SchemaModalInput } from '../../components/SchemaModalInput';
import NavbarContext from '../../context/NavbarContext';
import {
  getModelsAsync as getHfModelsAsync,
  selectModels as selectHfModels,
  selectLoading as selectHfModelsLoading,
} from './hfModelsSlice';
import {
  createModelAsync,
  getModelAsync,
  updateModelAsync,
  selectLoaded,
  selectModels,
} from './modelsSlice';

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

const typeOptions = [
  {
    label: 'LLM - Chat',
    value: 'gpt',
  },
  {
    label: 'LLM - Text',
    value: 'completion',
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

const providerOptions = [
  {
    label: 'OpenAI',
    value: 'openai',
  },
  {
    label: 'Vertex AI',
    value: 'vertexai',
  },
  {
    label: 'Local AI (Private instance)',
    value: 'localai',
  },
  // {
  //   label: 'GPT4All',
  //   value: 'gpt4all',
  // },
];

export function ModelForm() {

  const loaded = useSelector(selectLoaded);
  const models = useSelector(selectModels);

  const { setNavbarState } = useContext(NavbarContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();

  const typeValue = Form.useWatch('type', form);
  const typesDefinedValue = Form.useWatch('isTypesDefined', form);
  const returnTypeValue = Form.useWatch('returnType', form);

  const id = location.pathname.match(/\/models\/(.*)/)[1];
  const model = models[id];
  const isNew = id === 'new';

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

  const onCancel = () => {
    navigate('/models');
  };

  const onFinish = (values) => {
    if (isNew) {
      dispatch(createModelAsync({
        values: {
          ...values,
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
    navigate('/models');
  };

  const PanelHeader = ({ title }) => (
    <div style={{ borderBottom: '1px solid #d9d9d9' }}>
      {title}
    </div>
  );

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
        {/* <Collapse defaultActiveKey={['1']} ghost> */}
        {/* <Panel header={<PanelHeader title="Model Details" />} key="1" forceRender> */}
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
          label="Type"
          name="type"
          wrapperCol={{ span: 10 }}
        >
          <Select options={typeOptions} />
        </Form.Item>
        {typeValue === 'gpt' ?
          <Form.Item
            label="Provider"
            name="provider"
            wrapperCol={{ span: 10 }}
          >
            <Select options={providerOptions} />
          </Form.Item>
          : null
        }
        {typeValue === 'api' ?
          <Form.Item
            name="url"
            label="URL"
            wrapperCol={{ span: 10 }}
          >
            <Input />
          </Form.Item>
          : null
        }
        {typeValue === 'api' ?
          <Form.Item
            name="batchEndpoint"
            label="Batch Endpoint"
            wrapperCol={{ span: 10 }}
          >
            <Input />
          </Form.Item>
          : null
        }
        {/* {typeValue === 'huggingface' ?
          <Form.Item
            name="modelName"
            label="Model Name"
            wrapperCol={{ span: 10 }}
          >
            <Input />
          </Form.Item>
          : null
        } */}
        {/* </Panel> */}
        {typeValue === 'api' || typeValue === 'huggingface' ?
          // <Panel header={<PanelHeader title="Type Information" />} key="2" forceRender>
          <>
            <Form.Item
              colon={false}
              label="Define Types?"
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
                  wrapperCol={{ span: 10 }}
                >
                  <Select options={returnTypeOptions} />
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
          // </Panel>
          : null
        }
        {typeValue === 'huggingface' ?
          <>
            <Form.Item wrapperCol={{ offset: 4 }}>
              <div>** Requires elevated privileges for production grade endpoints, otherwise may take 20-30 minutes to prime. **</div>
            </Form.Item>
            <Form.Item
              label="Model Name"
              name="modeName"
              wrapperCol={{ span: 5 }}
            >
              <SearchInput />
            </Form.Item>
            <Form.Item
              label="Instance Type"
              name="instanceType"
              wrapperCol={{ span: 5 }}
            >
              <Select options={[]} />
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
                <Input type="number" />
              </Form.Item>
              <Form.Item
                label="Max"
                colon={false}
                name="maxScale"
                style={{ display: 'inline-block', width: 'calc(50% - 8px)', margin: '0 8px' }}
              >
                <Input type="number" />
              </Form.Item>
            </Form.Item>
          </>
          : null
        }
        {/* </Collapse> */}
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
