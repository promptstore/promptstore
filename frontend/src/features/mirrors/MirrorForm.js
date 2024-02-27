import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Checkbox, Form, Input, Space, Switch } from 'antd';
import ButterflyDataMapping from 'react-data-mapping';
import cloneDeep from 'lodash.clonedeep';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  getWorkspacesAsync,
  selectLoaded as selectTargetWorkspacesLoaded,
  selectWorkspaces,
} from '../workspaces/workspacesSlice';

import {
  createMirrorAsync,
  getMirrorAsync,
  getSourceWorkspacesAsync,
  selectLoaded,
  selectMirrors,
  selectSourceWorkspacesLoaded,
  selectSourceWorkspaces,
  updateMirrorAsync,
} from './mirrorsSlice';

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const mappingColumns = [
  {
    key: 'id',
    title: 'ID',
    width: 30,
    primaryKey: true,
  },
  {
    key: 'name',
    title: 'Name',
    width: 225,
    render: (val, row, index) => {
      return <div style={{ textAlign: 'left' }}>{val}</div>
    },
  },
];

const getFields = (id, title, workspaces) => ({
  id,
  title,
  fields: Object.values(workspaces).map((workspace) => ({
    id: String(workspace.id),
    name: workspace.name,
  }))
});

const objectOptions = [
  {
    label: 'Prompt Template',
    value: 'prompt-sets',
  },
  {
    label: 'Model',
    value: 'models',
  },
  {
    label: 'Semantic Function',
    value: 'functions',
  },
  {
    label: 'Semantic Index',
    value: 'indexes',
  },
  {
    label: 'Data Source',
    value: 'data-sources',
  },
];

export function MirrorForm() {

  const [serviceUrl, setServiceUrl] = useState(null);
  const [apiKeySecret, setApiKeySecret] = useState(null);

  const loaded = useSelector(selectLoaded);
  const mirrors = useSelector(selectMirrors);
  const sourceWorkspacesLoaded = useSelector(selectSourceWorkspacesLoaded);
  const sourceWorkspaces = useSelector(selectSourceWorkspaces);
  const targetWorkspacesLoaded = useSelector(selectTargetWorkspacesLoaded);
  const targetWorkspaces = useSelector(selectWorkspaces);

  // console.log('sourceWorkspaces:', sourceWorkspaces);
  // console.log('targetWorkspaces:', targetWorkspaces);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const allWorkspacesValue = Form.useWatch('allWorkspaces', form);

  const id = location.pathname.match(/\/mirrors\/(.*)/)[1];
  const mirror = mirrors[id];
  const isNew = id === 'new';

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Mirror',
    }));
    dispatch(getWorkspacesAsync());
    if (!isNew) {
      dispatch(getMirrorAsync(id));
    }
  }, []);

  useEffect(() => {
    if (mirror) {
      setServiceUrl(mirror.serviceUrl);
      setApiKeySecret(mirror.apiKeySecret);
    }
  }, [mirror]);

  useEffect(() => {
    if (serviceUrl && apiKeySecret && !sourceWorkspacesLoaded) {
      dispatch(getSourceWorkspacesAsync({ serviceUrl, apiKeySecret }));
    }
  }, [serviceUrl, apiKeySecret, sourceWorkspacesLoaded]);

  const onCancel = () => {
    navigate('/mirrors');
  };

  const onFinish = (values) => {
    if (isNew) {
      dispatch(createMirrorAsync({
        values: { ...values, workspaceId: selectedWorkspace.id },
      }));
    } else {
      dispatch(updateMirrorAsync({
        id,
        values: {
          ...mirror,
          ...values,
        },
      }));
    }
    navigate('/mirrors');
  };

  const targetDomain = window.location.hostname;
  const sourceDomain = useMemo(() => {
    if (serviceUrl) {
      try {
        const sourceUrl = new URL(serviceUrl);
        return sourceUrl.host;
      } catch (err) {
        return null;
      }
    }
  }, [serviceUrl]);

  const mappingControlReady = !allWorkspacesValue
    && targetWorkspacesLoaded
    && sourceWorkspacesLoaded
    && !!sourceDomain
    && !!targetDomain;

  // console.log('allWorkspacesValue:', allWorkspacesValue);
  // console.log('targetWorkspacesLoaded:', targetWorkspacesLoaded);
  // console.log('sourceWorkspacesLoaded:', sourceWorkspacesLoaded);
  // console.log('sourceDomain:', sourceDomain);
  // console.log('targetDomain:', targetDomain);
  // console.log('mappingControlReady:', mappingControlReady);

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
        name="mirror"
        autoComplete="off"
        onFinish={onFinish}
        initialValues={mirror}
        validateTrigger="onBlur"
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            {
              required: true,
              message: 'Please enter a mirror name',
            },
          ]}
          wrapperCol={{ span: 14 }}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Service URL"
          name="serviceUrl"
          rules={[
            {
              required: true,
              message: 'Please enter the Service URL',
            },
          ]}
          wrapperCol={{ span: 14 }}
        >
          <Input onBlur={(ev) => {
            setServiceUrl(ev.currentTarget.value);
          }} />
        </Form.Item>
        <Form.Item
          label="API Key Secret"
          name="apiKeySecret"
          rules={[
            {
              required: true,
              message: 'Please enter the API Key Secret',
            },
          ]}
          wrapperCol={{ span: 14 }}
          extra={
            <div>Create a <Link to="/secrets">secret</Link> in the System Workspace. Do not enter the actual key here.</div>
          }
        >
          <Input onBlur={(ev) => {
            setApiKeySecret(ev.currentTarget.value);
          }} />
        </Form.Item>
        <Form.Item
          label="All Workspaces"
          name="allWorkspaces"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        {mappingControlReady ?
          <Form.Item
            label="Workspaces"
            name="workspaceMapping"
          >
            <MappingInput
              initialSourceData={getFields('source', sourceDomain, sourceWorkspaces)}
              initialTargetData={getFields('target', targetDomain, targetWorkspaces)}
            />
          </Form.Item>
          : null
        }
        <Form.Item
          label="Objects"
          name="objects"
        >
          <Checkbox.Group options={objectOptions} />
        </Form.Item>
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

function MappingInput({ initialSourceData, initialTargetData, onChange, value }) {

  const [sourceData, setSourceData] = useState(initialSourceData);
  const [targetData, setTargetData] = useState(initialTargetData);
  const [selected, setSelected] = useState(false);

  const handleChange = (values) => {
    // console.log('values:', values);
    setSourceData(cloneDeep(values.sourceData));
    setTargetData(cloneDeep(values.targetData));
    // setSelected(values.sourceData.fields.filter(f => f.checked));
    onChange(values.mappingData);
  };

  const reset = () => {
    onChange([]);
  };

  // console.log('sourceData:', sourceData);
  // console.log('targetData:', targetData);
  // console.log('value:', value || []);

  // TODO `checkable` error - "Cannot read properties of undefined (reading 'dom')"
  return (
    <Space direction="vertical">
      <ButterflyDataMapping
        id="mirror-mapping"
        className="butterfly-data-mapping container single-with-header"
        type="single"
        columns={mappingColumns}
        sourceData={sourceData}
        targetData={targetData}
        config={{
          // checkable: { source: true, target: false, },
          // delayDraw: 500,
        }}
        width="auto"
        height="auto"
        onChange={handleChange}
        mappingData={value || []}
      />
      {selected.length ?
        <Space>
          <Button danger type="primary" size="small">
            Delete
          </Button>
          <div>{selected.length} selected</div>
        </Space>
        : null
      }
      <Button type="default" size="small"
        onClick={reset}
      >
        Reset
      </Button>
    </Space>
  );
}
