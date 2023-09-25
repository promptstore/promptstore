import React from 'react';
import { Descriptions } from 'antd';

import { Output, Plan } from './common';

export function PlanExecution({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item label="plan" span={3}>
        <Plan step={step} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        <Output step={step} />
      </Descriptions.Item>
    </Descriptions>
  );
}
