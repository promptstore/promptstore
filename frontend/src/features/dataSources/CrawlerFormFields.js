import React from 'react';
import { Form, Input, InputNumber } from 'antd';

import { SchemaModalInput } from '../../components/SchemaModalInput';

export function CrawlerFormFields() {
  return (
    <>
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '0 0 5px' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
          Web Crawler Parameters
        </div>
      </Form.Item>
      <Form.Item
        label="URL"
        name="baseUrl"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Maximum Requests"
        name="maxRequestsPerCrawl"
        wrapperCol={{ span: 5 }}
      >
        <InputNumber />
      </Form.Item>
      <Form.Item
        label="Chunk Element"
        name="chunkElement"
        wrapperCol={{ span: 5 }}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Scraping Spec"
        name="scrapingSpec"
        wrapperCol={{ span: 5 }}
      >
        <SchemaModalInput
          isSpec={true}
          title="Set Spec"
          placeholders={{
            title: 'selector',
            description: 'attribute (leave empty for text content)',
          }}
        />
      </Form.Item>
    </>
  );
}