import { useState } from 'react';
import { Button, Divider, Form, Input, Radio, Space } from 'antd';

function FileUploadForm({
  onCancel,
  onFieldsChange,
  onFinish,
  isNew,
  layout,
  source,
}) {

  const [nodeRefType, setNodeRefType] = useState(null);

  const onNodeRefTypeChange = (ev) => {
    setNodeRefType(ev.target.value);
  };

  return (
    <Form
      {...layout}
      name="source"
      autoComplete="off"
      onFieldsChange={onFieldsChange}
      onFinish={onFinish}
      initialValues={source}
    >
      <Form.Item
        label="Name"
        name="name"
        rules={[
          {
            required: true,
            message: 'Please enter the source name',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Divider orientation="left">Node file details</Divider>
      <Form.Item
        label="Filename"
        name={['props', 'nodesFilename']}
        rules={[
          {
            required: true,
            message: 'Please enter a filename',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Node Ref Type"
        name={['props', 'nodeRefType']}
        rules={[
          {
            required: true,
            message: 'Please select an option',
          },
        ]}
      >
        <Radio.Group onChange={onNodeRefTypeChange}>
          <Radio value="id"> ID </Radio>
          <Radio value="name"> Name </Radio>
        </Radio.Group>
      </Form.Item>
      <Form.Item
        label="ID field"
        name={['props', 'nodeIdField']}
        rules={[
          {
            required: nodeRefType === 'id',
            message: 'Please enter the column name',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Name field"
        name={['props', 'nodeNameField']}
        rules={[
          {
            required: true,
            message: 'Please enter the column name',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Type field"
        name={['props', 'nodeTypeField']}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Date field"
        name="nodeLastModifiedDateField"
      >
        <Input />
      </Form.Item>
      <Divider orientation="left">Relationship file details</Divider>
      <Form.Item
        label="Filename"
        name={['props', 'relsFilename']}
        rules={[
          {
            required: true,
            message: 'Please enter a filename',
          },
        ]}
      >
        {/* {source.status === 'done' ?
          <div>{source.relsFilename}</div>
          : */}
        <Input />
        {/* } */}
      </Form.Item>
      <Form.Item
        label="ID field"
        name={['props', 'relIdField']}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Name field"
        name={['props', 'relNameField']}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Type field"
        name={['props', 'relTypeField']}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="From Node field"
        name={['props', 'fromNodeIdNameField']}
        rules={[
          {
            required: true,
            message: 'Please enter the column name',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="To Node field"
        name={['props', 'toNodeIdNameField']}
        rules={[
          {
            required: true,
            message: 'Please enter the column name',
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Date field"
        name={['props', 'relLastModifiedDateField']}
      >
        <Input />
      </Form.Item>
      <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
        <Space>
          <Button type="default" onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            {isNew ? 'Submit' : 'Update'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}

export default FileUploadForm;
