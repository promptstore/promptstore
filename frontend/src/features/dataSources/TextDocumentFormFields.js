import React from 'react';
import { Form, Input, InputNumber, Select } from 'antd';

export function TextDocumentFormFields({
  chunkerFunctionOptions,
  functionsLoading,
  rephraseFunctionOptions,
  splitterOptions,
  splitterValue,
}) {
  return (
    <>
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '0 0 5px' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
          Text Chunking Parameters
        </div>
      </Form.Item>
      {/* <Form.Item
        label="Text Property"
        name="textProperty"
        initialValue="text"
        wrapperCol={{ span: 10 }}
      >
        <Input />
      </Form.Item> */}
      <Form.Item
        label="Split by"
        name="splitter"
        wrapperCol={{ span: 10 }}
      >
        <Select allowClear
          options={splitterOptions}
          optionFilterProp="label"
        />
      </Form.Item>
      {splitterValue === 'delimiter' ?
        <Form.Item
          label="Character(s)"
          name="characters"
          initialValue="\n\n"
          wrapperCol={{ span: 10 }}
        >
          <Input />
        </Form.Item>
        : null
      }
      {splitterValue === 'chunker' ?
        <Form.Item
          label="Chunker"
          name="functionId"
          wrapperCol={{ span: 10 }}
        >
          <Select allowClear
            loading={functionsLoading}
            options={chunkerFunctionOptions}
            optionFilterProp="label"
          />
        </Form.Item>
        : null
      }
      {splitterValue === 'token' ?
        <>
          <Form.Item
            label="Chunk Size"
            name="chunkSize"
            initialValue="2048"
            wrapperCol={{ span: 5 }}
          >
            <InputNumber />
          </Form.Item>
          <Form.Item
            label="Chunk Overlap"
            name="chunkOverlap"
            initialValue="24"
            wrapperCol={{ span: 5 }}
          >
            <InputNumber />
          </Form.Item>
        </>
        : null
      }
      <Form.Item
        label="Rephrase funcs"
        name="rephraseFunctionIds"
        wrapperCol={{ span: 10 }}
      >
        <Select allowClear
          loading={functionsLoading}
          mode="multiple"
          options={rephraseFunctionOptions}
          optionFilterProp="label"
        />
      </Form.Item>
    </>
  );
}