import { memo, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';
import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

import { TagsInput } from '../../components/TagsInput';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  getFunctionsByTagsAsync,
  selectFunctions,
  selectLoading as selectFunctionsLoading,
} from '../functions/functionsSlice';
import {
  getExtractorsAsync,
  selectExtractors,
  selectLoaded as selectExtractorsLoaded,
} from './extractorsSlice';

const layout = {
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
};

const splitterOptions = [
  {
    label: 'Delimiter',
    value: 'delimiter',
  },
  {
    label: 'Token',
    value: 'token',
  },
  {
    label: 'Chunking Function',
    value: 'chunker',
  },
];

const CSVFormFields = () => {
  return (
    <>
      <Form.Item
        label="Delimiter"
        name="delimiter"
        initialValue=","
      >
        <Input style={{ width: 88 }} />
      </Form.Item>
      <Form.Item
        label="Quote Char"
        name="quoteChar"
        initialValue={'"'}
      >
        <Input style={{ width: 88 }} />
      </Form.Item>
    </>
  );
};

const Neo4jFormFields = () => {
  return (
    <>
      <Form.Item
        label="Node Label"
        name="nodeLabel"
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Embedding Prop"
        name="embeddingNodeProperty"
        initialValue="embedding"
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Text Props"
        name="textNodeProperties"
      >
        <TagsInput />
      </Form.Item>
      <Form.Item
        label="Limit"
        name="limit"
        initialValue={1000}
      >
        <InputNumber />
      </Form.Item>
    </>
  );
};

export default memo(({ id, data, isConnectable }) => {

  const [modalOpen, setModalOpen] = useState(false);

  const extractors = useSelector(selectExtractors);
  const extractorsLoaded = useSelector(selectExtractorsLoaded);
  const functions = useSelector(selectFunctions);
  const functionsLoading = useSelector(selectFunctionsLoading);

  const { selectedWorkspace } = useContext(WorkspaceContext);

  const [form] = Form.useForm();
  const splitterValue = Form.useWatch('splitter', form);

  const chunkerFunctionOptions = useMemo(() => {
    if (functions) {
      return Object.values(functions)
        .filter((func) => func.tags?.includes('chunker'))
        .map((func) => ({
          label: func.name,
          value: func.id,
        }))
    }
    return [];
  }, [functions]);

  const rephraseFunctionOptions = useMemo(() => {
    if (functions) {
      return Object.values(functions)
        .filter((func) => func.tags?.includes('rephrase'))
        .map((func) => ({
          label: func.name,
          value: func.id,
        }))
    }
    return [];
  }, [functions]);

  const extractorOptions = useMemo(() => {
    if (extractors) {
      const options = Object.values(extractors).map((s) => ({
        label: s.name,
        value: s.key,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
    return [];
  }, [extractors]);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const dispatch = useDispatch();

  useEffect(() => {
    if (!extractorsLoaded) {
      dispatch(getExtractorsAsync());
    }
  }, [extractorsLoaded]);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getFunctionsByTagsAsync({ tags: ['chunker', 'rephrase'], workspaceId }));
    }
  }, [selectedWorkspace]);

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const extractor = evt.target.value;
          node.data = {
            ...node.data,
            extractor,
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

  const TextDocumentFormFields = () => {
    return (
      <>
        <Form.Item
          label="Split by"
          name="splitter"
          wrapperCol={{ span: 10 }}
        >
          <Select allowClear
            options={splitterOptions}
            optionFilterProp="label"
          />
        </Form.Item>
        {splitterValue === 'delimiter' ?
          <Form.Item
            label="Character(s)"
            name="characters"
            initialValue="\n\n"
          >
            <Input style={{ width: 88 }} />
          </Form.Item>
          : null
        }
        {splitterValue === 'chunker' ?
          <Form.Item
            label="Chunker"
            name="functionId"
          >
            <Select allowClear
              loading={functionsLoading}
              options={chunkerFunctionOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          : null
        }
        {splitterValue === 'token' ?
          <>
            <Form.Item
              label="Chunk Size"
              name="chunkSize"
              initialValue="2048"
              wrapperCol={{ span: 5 }}
            >
              <InputNumber />
            </Form.Item>
            <Form.Item
              label="Chunk Overlap"
              name="chunkOverlap"
              initialValue="24"
              wrapperCol={{ span: 5 }}
            >
              <InputNumber />
            </Form.Item>
          </>
          : null
        }
        <Form.Item
          label="Rephrase funcs"
          name="rephraseFunctionIds"
          wrapperCol={{ span: 10 }}
        >
          <Select allowClear
            loading={functionsLoading}
            mode="multiple"
            options={rephraseFunctionOptions}
            optionFilterProp="label"
          />
        </Form.Item>
      </>
    );
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
          {data.extractor === 'csv' ?
            <CSVFormFields />
            : null
          }
          {data.extractor === 'neo4j' ?
            <Neo4jFormFields />
            : null
          }
          {data.extractor === 'text' ?
            <TextDocumentFormFields />
            : null
          }
        </Form>
      </Modal>
      <div className="custom-node__header" style={{ display: 'flex' }}>
        <div>Extractor</div>
        <div style={{ flex: 1 }} />
        <SettingOutlined
          style={{ cursor: 'pointer' }}
          onClick={() => setModalOpen(true)}
        />
      </div>
      <div className="custom-node__body">
        <MySelect
          isConnectable={isConnectable}
          nodeId={id}
          onChange={onChange}
          options={extractorOptions}
          value={data.extractor}
        />
      </div>
    </>
  );
});

function MySelect({ isConnectable, onChange, options, value }) {
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
