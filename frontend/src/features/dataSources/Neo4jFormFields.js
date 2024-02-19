import React from 'react';
import { Form, Input, InputNumber, Select } from 'antd';

import { TagsInput } from '../../components/TagsInput';

export function Neo4jFormFields({
  indexesLoading,
  indexOptions,
}) {
  return (
    <>
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '0 0 5px' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
          Neo4j Parameters
        </div>
      </Form.Item>
      <Form.Item
        label="Node Label"
        name="nodeLabel"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Linked to Index"
        name="indexId"
        wrapperCol={{ span: 10 }}
      >
        <Select
          loading={indexesLoading}
          options={indexOptions}
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item
        label="Embedding Prop"
        name="embeddingNodeProperty"
        initialValue="embedding"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Text Props"
        name="textNodeProperties"
      >
        <TagsInput />
      </Form.Item>
      <Form.Item
        label="Limit"
        name="limit"
        initialValue={1000}
        wrapperCol={{ span: 10 }}
      >
        <InputNumber style={{ width: 100 }} />
      </Form.Item>
    </>
  );
}