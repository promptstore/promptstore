import React from 'react';
import { Divider, Form, Input } from 'antd';

const { TextArea } = Input;

export function FeastFormFields() {
  return (
    <>
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '0 0 5px' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
          Feast Parameters
        </div>
      </Form.Item>
      <Form.Item
        label="Feature Service"
        name="featureService"
        extra="Takes precedence over the feature list"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item wrapperCol={{ offset: 4, span: 10 }} style={{ margin: '-24px 0 0' }}>
        <Divider orientation="left" style={{ color: 'rgba(0,0,0,0.45)' }}>or</Divider>
      </Form.Item>
      <Form.Item
        label="Feature List"
        name="featureList"
        extra="Enter a comma-separated list"
        wrapperCol={{ span: 10 }}
      >
        <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
      </Form.Item>
      <Form.Item
        label="Entity"
        name="entity"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
    </>
  );
}