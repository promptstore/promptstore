import React from 'react';
import { Form, Input, Modal } from 'antd';

const { TextArea } = Input;

const layout = {
  wrapperCol: { span: 24 },
};

export function CreateContentModalForm({ open, onOk, onCancel }) {

  const [form] = Form.useForm();

  const handleOk = async () => {
    const values = await form.validateFields();
    onOk(values);
  };

  return (
    <Modal
      title="Create Content"
      okText="Create"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      width={800}
      mask={false}
    >
      <Form
        {...layout}
        form={form}
        name="create-content"
        autoComplete="off"
      >
        <Form.Item
          name="content"
          extra="Add user content"
        >
          <TextArea autoSize={{ minRows: 4, maxRows: 14 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};