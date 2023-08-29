import { useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Radio, Select, Space } from 'antd';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  getDialectsAsync,
  selectDialects,
} from '../dataSources/dataSourcesSlice';
import {
  createDestinationAsync,
  getDestinationAsync,
  selectDestinations,
  selectLoaded,
  updateDestinationAsync,
} from './destinationsSlice';

const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const typeOptions = [
  {
    label: 'Document',
    value: 'document',
  },
  {
    label: 'SQL',
    value: 'sql',
  },
];

export function DestinationForm() {

  const destinations = useSelector(selectDestinations);
  const dialects = useSelector(selectDialects);
  const loaded = useSelector(selectLoaded);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const typeValue = Form.useWatch('type', form);
  const dialectValue = Form.useWatch('dialect', form);
  const sqlTypeValue = Form.useWatch('sqlType', form);

  const id = location.pathname.match(/\/destinations\/(.*)/)[1];
  const destination = destinations[id];
  const isNew = id === 'new';

  const dialectOptions = useMemo(() => {
    const list = dialects.map((d) => ({
      label: d.name,
      value: d.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [dialects]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Destination',
    }));
    dispatch(getDialectsAsync());
    if (!isNew) {
      dispatch(getDestinationAsync(id));
    }
  }, []);

  const onCancel = () => {
    navigate('/destinations');
  };

  const onFinish = (values) => {
    if (isNew) {
      dispatch(createDestinationAsync({
        values: { ...values, workspaceId: selectedWorkspace.id },
      }));
    } else {
      dispatch(updateDestinationAsync({
        id,
        values: {
          ...destination,
          ...values,
        },
      }));
    }
    navigate('/destinations');
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
        name="destination"
        autoComplete="off"
        onFinish={onFinish}
        initialValues={destination}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            {
              required: true,
              message: 'Please enter a destination name',
            },
          ]}
          wrapperCol={{ span: 14 }}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Description"
          name="description"
          wrapperCol={{ span: 14 }}
        >
          <TextArea autoSize={{ minRows: 3, maxRows: 14 }} />
        </Form.Item>
        <Form.Item
          label="Type"
          name="type"
          rules={[
            {
              required: true,
              message: 'Please select the type',
            },
          ]}
          wrapperCol={{ span: 10 }}
        >
          <Select options={typeOptions} optionFilterProp="label" />
        </Form.Item>
        {typeValue === 'sql' ?
          <>
            <Form.Item
              label="Dialect"
              name="dialect"
              wrapperCol={{ span: 10 }}
            >
              <Select allowClear
                options={dialectOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            {dialectValue === 'postgresql' ?
              <>
                <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
                  <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                    Connection Info
                  </div>
                </Form.Item>
                <Form.Item
                  label="Connection String"
                  name="connectionString"
                  wrapperCol={{ span: 10 }}
                >
                  <Input />
                </Form.Item>
                {sqlTypeValue === 'sample' ?
                  <>
                    <Form.Item
                      label="Table"
                      name="tableName"
                      wrapperCol={{ span: 10 }}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      label="Sample Rows"
                      name="sampleRows"
                      wrapperCol={{ span: 2 }}
                    >
                      <Input type="number" />
                    </Form.Item>
                  </>
                  : null
                }
              </>
              : null
            }
            {dialectValue === 'bigquery' ?
              <>
                <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
                  <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                    Connection Info
                  </div>
                </Form.Item>
                <Form.Item
                  label="Dataset"
                  name="dataset"
                  wrapperCol={{ span: 10 }}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Table"
                  name="tableName"
                  wrapperCol={{ span: 10 }}
                >
                  <Input />
                </Form.Item>
                {sqlTypeValue === 'sample' ?
                  <>
                    <Form.Item
                      label="Sample Rows"
                      name="sampleRows"
                      wrapperCol={{ span: 2 }}
                    >
                      <Input type="number" />
                    </Form.Item>
                  </>
                  : null
                }
              </>
              : null
            }
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
