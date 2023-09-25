import React from 'react';
import { Descriptions } from 'antd';

import { Plan } from './common';

export function PlanParse({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item label="input" span={3}>
        {step.content}
      </Descriptions.Item>
      <Descriptions.Item label="plan" span={3}>
        <Plan step={step} />
      </Descriptions.Item>
    </Descriptions>
  );
}
