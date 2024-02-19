import React from 'react';
import { Form, Input } from 'antd';

import { SchemaModalInput } from '../../components/SchemaModalInput';

export function APIFormFields() {
  return (
    <>
      <Form.Item
        label="Endpoint"
        name="endpoint"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Schema"
        name="schema"
      >
        <SchemaModalInput />
      </Form.Item>
    </>
  );
}