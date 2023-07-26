import { useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Select, Space } from 'antd';

import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';

import {
  createAppAsync,
  getAppAsync,
  selectApps,
  selectLoaded,
  updateAppAsync,
} from './appsSlice';
import {
  getDataSourcesAsync,
  selectLoading as selectDataSourcesLoading,
  selectDataSources,
} from '../dataSources/dataSourcesSlice';
import {
  getFunctionsAsync,
  selectLoading as selectFunctionsLoading,
  selectFunctions,
} from '../functions/functionsSlice';
import {
  getIndexesAsync,
  selectLoading as selectIndexesLoading,
  selectIndexes,
} from '../indexes/indexesSlice';
import {
  getPromptSetsAsync,
  selectLoading as selectPromptSetsLoading,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';

const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

export function AppForm() {

  const [form] = Form.useForm();

  const apps = useSelector(selectApps);
  const loaded = useSelector(selectLoaded);
  const dataSources = useSelector(selectDataSources);
  const dataSourcesLoading = useSelector(selectDataSourcesLoading);
  const functions = useSelector(selectFunctions);
  const functionsLoading = useSelector(selectFunctionsLoading);
  const indexes = useSelector(selectIndexes);
  const indexesLoading = useSelector(selectIndexesLoading);
  const promptSets = useSelector(selectPromptSets);
  const promptSetsLoading = useSelector(selectPromptSetsLoading);

  const dataSourceOptions = useMemo(() => {
    const list = Object.values(dataSources).map((f) => ({
      value: f.id,
      label: f.name,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [dataSources]);

  const functionOptions = useMemo(() => {
    const list = Object.values(functions).map((f) => ({
      value: f.id,
      label: f.name,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [functions]);

  const indexOptions = useMemo(() => {
    const list = Object.values(indexes).map((f) => ({
      value: f.id,
      label: f.name,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [indexes]);

  const promptSetOptions = useMemo(() => {
    const list = Object.values(promptSets).map((f) => ({
      value: f.id,
      label: f.name,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [promptSets]);

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
    dispatch(getDataSourcesAsync());
    dispatch(getFunctionsAsync());
    dispatch(getIndexesAsync());
    if (!isNew) {
      dispatch(getAppAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getPromptSetsAsync({ workspaceId: selectedWorkspace.id }));
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
              label="Prompts"
              name="promptSets"
            >
              <Select
                allowClear
                options={promptSetOptions}
                optionFilterProp="label"
                loading={promptSetsLoading}
                mode="multiple"
              />
            </Form.Item>
            <Form.Item
              label="Semantic Functions"
              name="functions"
            >
              <Select
                allowClear
                options={functionOptions}
                optionFilterProp="label"
                loading={functionsLoading}
                mode="multiple"
              />
            </Form.Item>
            <Form.Item
              label="Data Sources"
              name="dataSources"
            >
              <Select
                allowClear
                options={dataSourceOptions}
                optionFilterProp="label"
                loading={dataSourcesLoading}
                mode="multiple"
              />
            </Form.Item>
            <Form.Item
              label="Indexes"
              name="indexes"
            >
              <Select
                allowClear
                options={indexOptions}
                optionFilterProp="label"
                loading={indexesLoading}
                mode="multiple"
              />
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