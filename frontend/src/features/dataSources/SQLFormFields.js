import React from 'react';
import { Form, Input, InputNumber, Radio, Select } from 'antd';

export function SQLFormFields({
  dialectOptions,
  dialectValue,
  sqlTypeOptions,
  sqlTypeValue,
}) {
  return (
    <>
      <Form.Item
        label="Dialect"
        name="dialect"
        wrapperCol={{ span: 10 }}
      >
        <Select allowClear
          options={dialectOptions}
          optionFilterProp="label"
        />
      </Form.Item>
      <Form.Item
        label="Metadata Source"
        name="sqlType"
      >
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={sqlTypeOptions}
        />
      </Form.Item>
      {dialectValue === 'postgresql' || dialectValue === 'bigquery' ?
        <>
          <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '0 0 5px' }}>
            <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
              Connection Info
            </div>
          </Form.Item>
          {dialectValue === 'postgresql' ?
            <Form.Item
              label="Connection String"
              name="connectionString"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
            : null
          }
          <Form.Item
            label={dialectValue === 'bigquery' ? 'Dataset' : 'Schema'}
            name="dataset"
            wrapperCol={{ span: 10 }}
          >
            <Input />
          </Form.Item>
          <Form.Item
            extra="Enter a comma separated list"
            label="Tables"
            name="tables"
            wrapperCol={{ span: 10 }}
          >
            <Input />
          </Form.Item>
          {sqlTypeValue === 'sample' ?
            <>
              <Form.Item
                label="Table"
                name="tableName"
                wrapperCol={{ span: 10 }}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Sample Rows"
                name="sampleRows"
                wrapperCol={{ span: 2 }}
              >
                <InputNumber />
              </Form.Item>
            </>
            : null
          }
        </>
        : null
      }
      {dialectValue === 'clickhouse' ?
        <>
          <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '0 0 5px' }}>
            <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
              Connection Info
            </div>
          </Form.Item>
          <Form.Item
            label="Host"
            name="databaseHost"
            wrapperCol={{ span: 10 }}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Database"
            name="databaseName"
            wrapperCol={{ span: 10 }}
          >
            <Input />
          </Form.Item>
          {sqlTypeValue === 'sample' ?
            <>
              <Form.Item
                label="Table"
                name="tableName"
                wrapperCol={{ span: 10 }}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Sample Rows"
                name="sampleRows"
                wrapperCol={{ span: 2 }}
              >
                <InputNumber />
              </Form.Item>
            </>
            : null
          }
          <Form.Item
            label="Credentials"
            name="credentials"
            wrapperCol={{ span: 10 }}
          >
            <Form.Item
              label="Username"
              name={['credentials', 'username']}
              colon={false}
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Password"
              name={['credentials', 'password']}
              colon={false}
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Input type="password" />
            </Form.Item>
          </Form.Item>
        </>
        : null
      }
    </>
  );
}