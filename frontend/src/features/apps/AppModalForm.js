import { useEffect, useState } from 'react';
import { Form, Modal, Select } from 'antd';

const layout = {
  labelCol: { span: 5 },
  wrapperCol: { span: 19 },
};

const formatOptions = [
  {
    label: 'Email Subject line',
    value: 'email subject line',
  },
  {
    label: 'Email Copy',
    value: 'email content',
  },
  {
    label: 'CTA',
    value: 'call-to-action, CTA',
  },
  {
    label: 'SMS/Chat',
    value: 'sms, chat',
  },
  {
    label: 'Social Media',
    value: 'social media',
  },
  {
    label: 'Web Copy',
    value: 'web content',
  },
];

const journeyOptions = [
  {
    label: 'Welcome',
    value: 'Welcome',
  },
  {
    label: 'Cross Sell',
    value: 'Cross Sell',
  },
  {
    label: 'Upsell',
    value: 'Upsell',
  },
  {
    label: 'End of Contract',
    value: 'End of Contract',
  },
  {
    label: 'Service',
    value: 'Service',
  },
  {
    label: 'Benefits',
    value: 'Benefits',
  },
];

const needStateOptions = [
  {
    label: 'Gaming',
    value: 'gaming',
  },
  {
    label: 'Children\'s Education',
    value: 'children\'s education',
  },
  {
    label: 'Working from Anywhere',
    value: 'working from anywhere',
  },
  {
    label: 'Home is the Hub',
    value: 'home is the hub',
  },
];

const productCategoryOptions = [
  {
    label: 'Mobile Phones',
    value: 'mobile phones',
  },
  {
    label: 'Data Plans',
    value: 'data plans',
  },
  {
    label: 'Watches',
    value: 'watches',
  },
  {
    label: 'Laptops and tablets',
    value: 'laptops and tablets',
  },
  {
    label: 'Broadband',
    value: 'broadband',
  },
  {
    label: 'Home Security',
    value: 'home security',
  },
  {
    label: 'Cyber Security',
    value: 'cyber security',
  },
  {
    label: 'Gaming',
    value: 'gaming',
  },
  {
    label: 'Accessories',
    value: 'accessories',
  },
];

const productOptionsByCategory = {
  'mobile phones': [
    {
      label: 'Samsung Galaxy',
      value: 'Samsung Galaxy',
    },
    {
      label: 'iPhone 14',
      value: 'iPhone 14',
    },
    {
      label: 'Google Pixel',
      value: 'Google Pixel',
    },
    {
      label: 'OPPO Find',
      value: 'OPPO Find',
    },
    {
      label: 'OPPO Reno8',
      value: 'OPPO Reno8',
    },
    {
      label: 'Sony Xperia',
      value: 'Sony Xperia',
    },
    {
      label: 'Fairphone',
      value: 'Fairphone',
    },
    {
      label: 'Motorola Edge',
      value: 'Motorola Edge',
    },
    {
      label: 'Doro',
      value: 'Doro',
    },
  ],
  'data plans': [
    {
      label: '250GB',
      value: '250GB',
    },
    {
      label: 'Unlimited',
      value: 'Unlimited',
    },
  ],
  'watches': [
    {
      label: 'Apple Watch',
      value: 'Apple Watch',
    },
    {
      label: 'Samsung Galaxy Watch',
      value: 'Samsung Galaxy Watch',
    },
    {
      label: 'Google Pixel Watch',
      value: 'Google Pixel Watch',
    },
    {
      label: 'Xplora Watch',
      value: 'Xplora Watch',
    },
  ],
  'laptops and tablets': [
    {
      label: 'Galaxy Book',
      value: 'Galaxy Book',
    },
    {
      label: 'iPad',
      value: 'iPad',
    },
    {
      label: 'Microsoft Surface Pro',
      value: 'Microsoft Surface Pro',
    },
    {
      label: 'Lenovo Tablet',
      value: 'Lenovo Tablet',
    },
  ]
};

const styleOptions = [
  {
    label: 'Persuasive',
    value: 'persuasive',
  },
  {
    label: 'Humourous',
    value: 'humourous',
  },
  {
    label: 'Family orientated',
    value: 'family orientated',
  },
  {
    label: 'Customer centric',
    value: 'customer centric',
  },
  {
    label: 'Urgency',
    value: 'urgency',
  },
  {
    label: 'Service-led',
    value: 'service-led',
  },
  {
    label: 'Sale',
    value: 'Sale',
  },
];

const uspOptions = [
  {
    label: 'Product Features',
    value: 'product features',
  },
  {
    label: 'Included Data',
    value: 'included data',
  },
  {
    label: 'Value',
    value: 'value',
  },
  {
    label: 'Save Time',
    value: 'save time',
  },
  {
    label: 'Save Money',
    value: 'save money',
  },
];

export function AppModalForm({ open, onOk, onCancel, registerResetCallback, values }) {

  const [productOptions, setProductOptions] = useState([]);

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

  const onProductCategoryChange = (value) => {
    form.resetFields(['product']);
    setProductOptions(productOptionsByCategory[value]);
  };

  const reset = () => {
    form.resetFields();
  };

  return (
    <Modal
      title="Define Primary Features"
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
        initialValues={values}
      >
        <Form.Item
          label="Format"
          name="format"
        >
          <Select allowClear
            options={formatOptions}
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          label="Journey"
          name="journey"
        >
          <Select allowClear
            options={journeyOptions}
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          label="Need State"
          name="needState"
        >
          <Select allowClear
            options={needStateOptions}
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          label="Product Category"
          name="productCategory"
        >
          <Select allowClear
            onChange={onProductCategoryChange}
            options={productCategoryOptions}
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          label="Product"
          name="product"
        >
          <Select allowClear
            options={productOptions}
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          label="Style"
          name="style"
        >
          <Select allowClear
            options={styleOptions}
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          label="Unique Selling Points"
          name="usp"
        >
          <Select allowClear
            mode="multiple"
            options={uspOptions}
            optionFilterProp="label"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};