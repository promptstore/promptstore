import { useEffect } from 'react';
import { Button, Form, Input, Modal } from 'antd';

const layout = {
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
};

const { TextArea } = Input;

export function SnippetModal({
  onCancel,
  onDelete,
  onSubmit,
  open,
  value,
  width = 520,
}) {

  const [form] = Form.useForm();

  useEffect(() => {
    if (value) {
      form.setFieldsValue(value);
    }
  }, [value]);

  const onOk = async () => {
    const values = await form.validateFields();
    onSubmit(values);
  };

  return (
    <Modal
      title="Snippet"
      okText={value ? 'Edit' : 'Create'}
      onCancel={onCancel}
      onOk={onOk}
      open={open}
      width={width}
      footer={(_, { OkBtn, CancelBtn }) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {value ?
            <Button danger
              type="primary"
              onClick={() => onDelete(value.key)}
            >
              Delete
            </Button>
            : null
          }
          <div style={{ flex: 1 }} />
          <CancelBtn />
          <OkBtn />
        </div>
      )}
    >
      <Form
        {...layout}
        form={form}
      >
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
          label="Content"
          name="content"
          rules={[
            {
              required: true,
              message: 'Please enter the content',
            },
          ]}
        >
          <TextArea
            autoSize={{ minRows: 4, maxRows: 14 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}