import React from 'react';
import { Form, Select, Switch } from 'antd';

import { SchemaModalInput } from '../../components/SchemaModalInput';

export function DocumentFormFields({
  documentTypeOptions,
  documentOptions,
  extractMetadataValue,
  uploadsLoading,
}) {
  return (
    <>
      <Form.Item
        label="Document Type"
        name="documentType"
        wrapperCol={{ span: 10 }}
      >
        <Select
          options={documentTypeOptions}
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item
        label="Documents"
        name="documents"
        wrapperCol={{ span: 10 }}
      >
        <Select allowClear
          loading={uploadsLoading}
          mode="multiple"
          options={documentOptions}
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item
        label="Extract Metadata"
      >
        <Form.Item
          name="extractMetadata"
          valuePropName="checked"
          style={{ display: 'inline-block', margin: 0 }}
        >
          <Switch disabled />
        </Form.Item>
        {extractMetadataValue ?
          <Form.Item
            label="Schema"
            name="extractSchema"
            style={{ display: 'inline-block', margin: '0 0 0 16px' }}
          >
            <SchemaModalInput />
          </Form.Item>
          : null
        }
      </Form.Item>
    </>
  );
}