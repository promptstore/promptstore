import React from 'react';
import { Form, Input, Switch } from 'antd';

export function FolderFormFields() {
  return (
    <>
      <Form.Item
        label="Bucket"
        name="bucket"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Path"
        name="prefix"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Recursive"
        name="recursive"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>
    </>
  );
}