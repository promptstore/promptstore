import React from 'react';
import { Descriptions } from 'antd';
import ReactJson from 'react-json-view';

import { Boolean } from './common';

export function Validation({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <ReactJson collapsed src={step.instance} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="schema">
        <ReactJson collapsed src={step.schema} />
      </Descriptions.Item>
      <Descriptions.Item label="valid" span={1}>
        <Boolean value={step.valid} />
      </Descriptions.Item>
    </Descriptions>
  );
}
