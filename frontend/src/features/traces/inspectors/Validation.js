import React from 'react';
import { Descriptions } from 'antd';

import { JsonView } from '../../../components/JsonView';
import { Boolean } from './common';

export function Validation({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <JsonView collapsed={1} src={step.instance} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="schema">
        <JsonView src={step.schema} />
      </Descriptions.Item>
      <Descriptions.Item label="valid" span={1}>
        <Boolean value={step.valid} />
      </Descriptions.Item>
    </Descriptions>
  );
}
