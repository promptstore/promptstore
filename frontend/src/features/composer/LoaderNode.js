import { memo, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';
import { Form, Input, InputNumber, Modal, Switch } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

import { SchemaModalInput } from '../../components/SchemaModalInput';
import {
  getLoadersAsync,
  selectLoaders,
  selectLoaded as selectLoadersLoaded,
} from './loadersSlice';

const layout = {
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
};

const APIFormFields = () => {
  return (
    <>
      <Form.Item
        label="Endpoint"
        name="endpoint"
        rules={[
          {
            required: true,
            message: 'Please enter the endpoint',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Schema"
        name="schema"
        rules={[
          {
            required: true,
            message: 'Please define the schema',
          },
        ]}
      >
        <SchemaModalInput />
      </Form.Item>
    </>
  );
};

const ConfluenceFormFields = () => {
  return (
    <>
      <Form.Item
        label="Space Key"
        name="spaceKey"
        rules={[
          {
            required: true,
            message: 'Please enter the Space name',
          },
        ]}
      >
        <Input />
      </Form.Item>
    </>
  )
};

const QueryFormFields = () => {
  return (
    <>
      <Form.Item
        label="Query"
        name="query"
      >
        <Input />
      </Form.Item>
    </>
  )
};

const ObjectStorageFields = () => {
  return (
    <>
      <Form.Item
        label="Bucket"
        name="bucket"
        rules={[
          {
            required: true,
            message: 'Please enter the bucket name',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Path"
        name="prefix"
        extra="Add final forward slash if not recursive"
        rules={[
          {
            required: true,
            message: 'Please enter the path',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        labelCol={{ span: 0 }}
      >
        <Form.Item
          colon={false}
          label="Recursive"
          name="recursive"
          style={{ display: 'inline-block' }}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form.Item>
    </>
  );
};

const CrawlerFormFields = () => {
  return (
    <>
      <Form.Item
        label="URL"
        name="baseUrl"
        rules={[
          {
            required: true,
            message: 'Please enter the Base URL',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Maximum Requests"
        name="maxRequestsPerCrawl"
      >
        <InputNumber />
      </Form.Item>
      <Form.Item
        label="Chunk Element"
        name="chunkElement"
        rules={[
          {
            required: true,
            message: 'Please specify the Chunk Element',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Scraping Spec"
        name="scrapingSpec"
        rules={[
          {
            required: true,
            message: 'Please define the scraping specification',
          },
        ]}
      >
        <SchemaModalInput
          isSpec={true}
          title="Set Spec"
          placeholders={{
            title: 'selector',
            description: 'attribute (leave empty for text content)',
          }}
        />
      </Form.Item>
    </>
  );
}

const WikipediaFormFields = () => {
  return (
    <Form.Item
      label="Query"
      name="query"
      rules={[
        {
          required: true,
          message: 'Please enter the query',
        },
      ]}
    >
      <Input />
    </Form.Item>
  );
};

export default memo(({ id, data, isConnectable }) => {

  const [modalOpen, setModalOpen] = useState(false);

  const loaders = useSelector(selectLoaders);
  const loadersLoaded = useSelector(selectLoadersLoaded);

  const [form] = Form.useForm();

  const loaderOptions = useMemo(() => {
    if (loaders) {
      const options = Object.values(loaders).map((s) => ({
        label: s.name,
        value: s.key,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [loaders]);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const dispatch = useDispatch();

  useEffect(() => {
    if (!loadersLoaded) {
      dispatch(getLoadersAsync());
    }
  }, [loadersLoaded]);

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const loader = evt.target.value;
          node.data = {
            ...node.data,
            loader,
          };
        }
        return node;
      })
    );
  };

  const onCancel = () => {
    setModalOpen(false);
  };

  const onOk = async () => {
    const values = await form.validateFields();
    console.log('values:', values);
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          node.data = {
            ...node.data,
            ...values,
          };
        }
        return node;
      })
    );
    setModalOpen(false);
  };

  return (
    <>
      <Modal
        onCancel={onCancel}
        onOk={onOk}
        open={modalOpen}
        title="Settings"
      >
        <Form
          {...layout}
          form={form}
          initialValues={data}
        >
          {data.loader === 'api' ?
            <APIFormFields />
            : null
          }
          {data.loader === 'confluence' ?
            <ConfluenceFormFields />
            : null
          }
          {['gmail', 'googlesearch', 'notion'].includes(data.loader) ?
            <QueryFormFields />
            : null
          }
          {['gcs', 'googledrive', 'minio', 's3'].includes(data.loader) ?
            <ObjectStorageFields />
            : null
          }
          {data.loader === 'crawler' ?
            <CrawlerFormFields />
            : null
          }
          {data.loader === 'wikipedia' ?
            <WikipediaFormFields />
            : null
          }
        </Form>
      </Modal>
      <div className="custom-node__header" style={{ display: 'flex' }}>
        <div>Loader</div>
        <div style={{ flex: 1 }} />
        <SettingOutlined
          style={{ cursor: 'pointer' }}
          onClick={() => setModalOpen(true)}
        />
      </div>
      <div className="custom-node__body">
        <Select
          isConnectable={isConnectable}
          nodeId={id}
          onChange={onChange}
          options={loaderOptions}
          value={data.loader}
        />
      </div>
    </>
  );
});

function Select({ isConnectable, onChange, options, value }) {
  return (
    <div className="custom-node__select">
      <select className="nodrag" onChange={onChange} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </div>
  );
}
