import React from 'react';
import { Descriptions } from 'antd';
import ReactJson from 'react-json-view';

import { Messages, Plan } from './common';

export function PlanModelCall({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <Messages step={step} />
      </Descriptions.Item>
      <Descriptions.Item label="plan" span={3}>
        <Plan step={step} />
      </Descriptions.Item>
      <Descriptions.Item label="model" span={1}>
        {step.model}
      </Descriptions.Item>
      <Descriptions.Item label="params" span={2}>
        <ReactJson collapsed src={step.modelParams} />
      </Descriptions.Item>
    </Descriptions>
  );
}
