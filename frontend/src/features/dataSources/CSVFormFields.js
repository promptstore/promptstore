import React from 'react';
import { Form, Input } from 'antd';

export function CSVFormFields() {
  return (
    <>
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '0 0 5px' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
          CSV Parameters
        </div>
      </Form.Item>
      <Form.Item
        label="Delimiter"
        name="delimiter"
        initialValue=","
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Quote Char"
        name="quoteChar"
        initialValue={'"'}
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
    </>
  );
}