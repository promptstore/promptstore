import { useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Select, Space, Switch } from 'antd';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  createAppAsync,
  getAppAsync,
  selectApps,
  selectLoaded,
  updateAppAsync,
} from './appsSlice';
import {
  getFunctionsAsync,
  selectLoading as selectFunctionsLoading,
  selectFunctions,
} from '../functions/functionsSlice';

const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 16 },
};

const appTypeOptions = [
  {
    value: 'analyst',
    label: 'Analyst',
  },
  {
    value: 'chat',
    label: 'Chat',
  },
];

export function AppFormNew() {

  const [form] = Form.useForm();

  const apps = useSelector(selectApps);
  const loaded = useSelector(selectLoaded);
  const functions = useSelector(selectFunctions);
  const functionsLoading = useSelector(selectFunctionsLoading);

  const allowUploadValue = Form.useWatch('allowUpload', form);

  const functionOptions = useMemo(() => {
    const list = Object.values(functions).map((f) => ({
      value: f.id,
      label: f.name,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [functions]);

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const id = location.pathname.match(/\/apps-edit\/(.*)/)[1];
  const isNew = id === 'new';
  const app = apps[id];

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'App',
    }));
    if (!isNew) {
      dispatch(getAppAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getFunctionsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  const onCancel = () => {
    navigate('/apps');
  };

  const onFinish = (values) => {
    if (isNew) {
      dispatch(createAppAsync({
        values: {
          ...values,
          workspaceId: selectedWorkspace.id,
        }
      }));
    } else {
      dispatch(updateAppAsync({
        id,
        values,
      }));
    }
    navigate('/apps');
  };

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex' }}>
          <div style={{ marginLeft: 'auto' }}>
            <Space>
            </Space>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <Form
            form={form}
            {...layout}
            name="app"
            autoComplete="off"
            onFinish={onFinish}
            initialValues={app}
          >
            <Form.Item
              label="Name"
              name="name"
              rules={[
                {
                  required: true,
                  message: 'Please enter a app name',
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Description"
              name="description"
            >
              <TextArea
                autoSize={{ minRows: 2, maxRows: 14 }}
              />
            </Form.Item>
            <Form.Item
              label="App Type"
              name="appType"
              initialValue="chat"
            >
              <Select
                allowClear
                options={appTypeOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item
              label="Semantic Function"
              name="function"
            >
              <Select
                allowClear
                options={functionOptions}
                optionFilterProp="label"
                loading={functionsLoading}
              />
            </Form.Item>
            <Form.Item
              label="Allow Upload"
            >
              <Form.Item
                name="allowUpload"
                valuePropName="checked"
                style={{ display: 'inline-block', margin: 0 }}
              >
                <Switch />
              </Form.Item>
              {allowUploadValue ?
                <Form.Item
                  label="as new index"
                  name="uploadAsNewIndex"
                  style={{ display: 'inline-block', margin: '0 0 0 16px' }}
                  initialValue={true}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                : null
              }
            </Form.Item>
            <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
              <Space>
                <Button type="default" onClick={onCancel}>Cancel</Button>
                <Button type="primary" htmlType="submit">Submit</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </div>
    </>
  );
};