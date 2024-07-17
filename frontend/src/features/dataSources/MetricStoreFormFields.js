import React from 'react';
import { Form, Input, Radio, Select } from 'antd';

import { SchemaModalInput } from '../../components/SchemaModalInput';

export function MetricStoreFormFields({
  metricstoreOptions,
  httpMethodOptions,
}) {
  return (
    <>
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '0 0 5px' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
          Metrics Store Connection Info
        </div>
      </Form.Item>
      <Form.Item
        label="Metrics Store"
        name="metricstore"
        wrapperCol={{ span: 10 }}
      >
        <Select
          options={metricstoreOptions}
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item
        label="HTTP Method"
        name="httpMethod"
        wrapperCol={{ span: 10 }}
      >
        <Radio.Group
          options={httpMethodOptions}
          optionType="button"
          buttonStyle="solid"
        />
      </Form.Item>
      <Form.Item
        label="GraphQL URL"
        name="url"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Environment ID"
        name="environmentId"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Credentials"
        wrapperCol={{ span: 10 }}
      >
        <Form.Item
          label="Service Token"
          name="serviceToken"
          colon={false}
          style={{ display: 'inline-block', width: 'calc(50%)', marginLeft: 16 }}
        >
          <Input type="password" />
        </Form.Item>
      </Form.Item>
    </>
  );
}