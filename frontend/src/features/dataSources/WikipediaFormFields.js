import React from 'react';
import { Form, Input } from 'antd';

export function WikipediaFormFields() {
  return (
    <Form.Item
      label="Query"
      name="query"
      wrapperCol={{ span: 10 }}
    >
      <Input />
    </Form.Item>
  );
}