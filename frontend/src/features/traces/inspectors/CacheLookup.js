import React from 'react';
import { Descriptions } from 'antd';

import { Boolean, Output, Prompt } from './common';

export function CacheLookup({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <Prompt step={step} />
      </Descriptions.Item>
      <Output step={step} />
      <Descriptions.Item label="model" span={2}>
        {step.model}
      </Descriptions.Item>
      <Descriptions.Item label="hit" span={1}>
        <Boolean value={step.hit} />
      </Descriptions.Item>
    </Descriptions>
  );
}
