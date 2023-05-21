import React from 'react';
import { Button, Form, Input, InputNumber } from 'antd';

const { TextArea } = Input;

const initialValues = {
  n: 1,
};

export function ImageParamsForm({ generate }) {

  const [form] = Form.useForm();

  const handleGenerate = () => {
    const values = form.getFieldsValue(true);
    generate(values);
  };

  return (
    <Form
      autoComplete="off"
      form={form}
      initialValues={initialValues}
      layout="vertical"
      name="image-params"
    >
      <Form.Item
        label="Number Variations"
        name="n"
      >
        <InputNumber />
      </Form.Item>
      <Form.Item
        label="Prompt"
        name="prompt"
      >
        <TextArea autoSize={{ minRows: 4, maxRows: 14 }} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" onClick={handleGenerate}>Generate</Button>
      </Form.Item>
    </Form>
  );
}