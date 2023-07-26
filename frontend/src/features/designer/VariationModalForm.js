import { useEffect, useState } from 'react';
import { Form, Modal, Select, Transfer } from 'antd';

import { optionsMap, variationOptions } from './options';

const layout = {
  labelCol: { span: 5 },
  wrapperCol: { span: 19 },
};

export function VariationModalForm({ open, onOk, onCancel, promptSetOptions, registerResetCallback }) {

  const [targetKeys, setTargetKeys] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [dataSource, setDataSource] = useState(null);
  const [label, setLabel] = useState(null);

  const [form] = Form.useForm();

  useEffect(() => {
    registerResetCallback(reset);
  }, []);

  const handleCancel = () => {
    onCancel();
    form.resetFields();
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    onOk(values);
    form.resetFields();
  };

  const onChange = (value) => {
    form.resetFields(['entity']);
    let label, ds;
    if (value === 'prompt') {
      label = 'Prompts';
      // The `Transfer` component has a different option format than `Select`
      ds = promptSetOptions.map(({ label, value }) => ({
        key: value,
        title: label,
      }));
    } else {
      [label, ds] = optionsMap[value];
    }
    setDataSource(ds);
    setLabel(label);
  };

  const onFinish = () => {
    setLabel(null);
    setDataSource(null);
  };

  const onSelectChange = (sourceSelectedKeys, targetSelectedKeys) => {
    setSelectedKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
  };

  const onTargetChange = (nextTargetKeys, direction, moveKeys) => {
    setTargetKeys(nextTargetKeys);
  };

  const reset = () => {
    form.resetFields();
    setLabel(null);
    setDataSource(null);
    setTargetKeys([]);
    setSelectedKeys([]);
  };

  return (
    <Modal
      title="Define Variations"
      okText="Set"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      width={800}
    >
      <Form
        {...layout}
        form={form}
        name="variation"
        autoComplete="off"
        onFinish={onFinish}
      >
        <Form.Item
          label="Vary by"
          name="key"
        >
          <Select
            onChange={onChange}
            options={variationOptions}
            optionFilterProp="label"
            style={{ width: 568 }}
          />
        </Form.Item>
        {label &&
          <Form.Item
            label={'Selected ' + label}
            name="values"
          >
            <Transfer
              dataSource={dataSource}
              titles={['Options', 'Selected']}
              targetKeys={targetKeys}
              selectedKeys={selectedKeys}
              onChange={onTargetChange}
              onSelectChange={onSelectChange}
              render={(item) => item.title}
              listStyle={{
                width: 250,
              }}
            />
          </Form.Item>
        }
      </Form>
    </Modal>
  );
};