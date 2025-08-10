import { memo, useContext, useState } from 'react';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';
import { Form, Modal } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import MonacoEditor from 'react-monaco-editor';

import NavbarContext from '../../contexts/NavbarContext';

const monacoOptions = { selectOnLineNumbers: true };

const layout = {
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
};

export default memo(({ id, data, isConnectable }) => {
  const [modalOpen, setModalOpen] = useState(false);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const { isDarkMode } = useContext(NavbarContext);

  const [form] = Form.useForm();

  const onCancel = () => {
    setModalOpen(false);
  };

  const onOk = async () => {
    const values = await form.validateFields();
    console.log('values:', values);
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map(node => {
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
      <Modal onCancel={onCancel} onOk={onOk} open={modalOpen} title="Settings" width={750}>
        <Form {...layout} form={form} initialValues={data}>
          <Form.Item label="Switching Logic" name="forkCode">
            <MonacoEditor
              height={250}
              language="javascript"
              theme={isDarkMode ? 'vs-dark' : 'vs-light'}
              options={monacoOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
      <div className="custom-node__header" style={{ display: 'flex' }}>
        <div>Fork</div>
        <div style={{ flex: 1 }} />
        <SettingOutlined style={{ cursor: 'pointer' }} onClick={() => setModalOpen(true)} />
      </div>
      <div className="custom-node__body">
        <Select isConnectable={isConnectable} nodeId={id} />
      </div>
    </>
  );
});

function Select({ isConnectable }) {
  return (
    <div className="custom-node__select">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </div>
  );
}
