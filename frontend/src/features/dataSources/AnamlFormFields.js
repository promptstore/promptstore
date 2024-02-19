import React from 'react';
import { Form, Input } from 'antd';

export function AnamlFormFields() {
  return (
    <>
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '0 0 5px' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
          Anaml Parameters
        </div>
      </Form.Item>
      <Form.Item
        label="Feature Store Name"
        name="featureStoreName"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
    </>
  );
}