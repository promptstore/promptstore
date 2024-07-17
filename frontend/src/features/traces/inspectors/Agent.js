import React from 'react';
import { Descriptions } from 'antd';

import { JsonView } from '../../../components/JsonView';
import { Output, Tools } from './common';

export function Agent({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="agent">
        {step.name}
      </Descriptions.Item>
      <Descriptions.Item span={3} label="goal">
        {step.goal}
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        <Output step={step} />
      </Descriptions.Item>
      <Descriptions.Item span={1} label="allowed tools">
        <Tools step={step} />
      </Descriptions.Item>
      <Descriptions.Item label="extra function params" span={2}>
        <JsonView src={step.extraFunctionCallParams} />
      </Descriptions.Item>
    </Descriptions>
  );
}
