import React from 'react';
import { Form, Select } from 'antd';

export function GraphStoreFormFields({ graphstoreOptions }) {
  return (
    <>
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '0 0 5px' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
          Knowledge Graph Connection Info
        </div>
      </Form.Item>
      <Form.Item
        label="Knowledge Graph"
        name="graphstore"
        wrapperCol={{ span: 10 }}
      >
        <Select
          options={graphstoreOptions}
          optionFilterProp="label"
        />
      </Form.Item>
      {/* <Form.Item
        label="Host"
        name="host"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Credentials"
        wrapperCol={{ span: 10 }}
      >
        <Form.Item
          label="Username"
          name="uaername"
          colon={false}
          style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Password"
          name="password"
          colon={false}
          style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
        >
          <Input type="password" />
        </Form.Item>
      </Form.Item> */}
    </>
  );
}