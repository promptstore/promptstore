import { useContext, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Collapse, Form, Input, Select, Space, Switch } from 'antd';
import { JsonSchemaEditor } from '@markmo/json-schema-editor-antd';

import NavbarContext from '../../context/NavbarContext';
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
    label: 'API',
    value: 'api',
  },
  {
    label: 'ChatGPT',
    value: 'gpt',
  },
  {
    label: 'Text Completion',
    value: 'completion',
  },
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
        <Collapse defaultActiveKey={['1']} ghost>
          <Panel header={<PanelHeader title="Model Details" />} key="1" forceRender>
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
              <TextArea autoSize={{ minRows: 3, maxRows: 14 }} />
            </Form.Item>
            <Form.Item
              label="Type"
              name="type"
              wrapperCol={{ span: 10 }}
            >
              <Select options={typeOptions} />
            </Form.Item>
          </Panel>
          {typeValue === 'api' ?
            <Panel header={<PanelHeader title="Type Information" />} key="2" forceRender>
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
                    <JsonSchemaEditor />
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
                      <JsonSchemaEditor />
                    </Form.Item>
                    : null
                  }
                </>
                : null
              }
            </Panel>
            : null
          }
        </Collapse>
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