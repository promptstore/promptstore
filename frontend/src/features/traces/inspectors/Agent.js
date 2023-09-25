import React from 'react';
import { Descriptions } from 'antd';
import ReactJson from 'react-json-view';

import { Output, Tools } from './common';

export function Agent({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="agent">
        {step.agentName}
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
        <ReactJson collapsed src={step.extraFunctionCallParams} />
      </Descriptions.Item>
    </Descriptions>
  );
}
