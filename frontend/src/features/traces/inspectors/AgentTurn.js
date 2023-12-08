import React from 'react';
import { Descriptions } from 'antd';

import { JsonView } from '../../../components/JsonView';
import { Boolean, Messages } from './common';

export function AgentTurn({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item label="step" span={3}>
        {'Turn ' + (step.index + 1)}
      </Descriptions.Item>
      <Descriptions.Item span={3} label="input">
        <Messages step={step} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        {step.content}
      </Descriptions.Item>
      <Descriptions.Item span={3} label="done">
        <Boolean value={step.done} />
      </Descriptions.Item>
      <Descriptions.Item label="model" span={1}>
        {step.model}
      </Descriptions.Item>
      <Descriptions.Item label="params" span={2}>
        <JsonView src={step.modelParams} />
      </Descriptions.Item>
    </Descriptions>
  );
}
