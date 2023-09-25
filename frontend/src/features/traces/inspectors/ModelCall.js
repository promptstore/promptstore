import React from 'react';
import { Descriptions } from 'antd';
import ReactJson from 'react-json-view';

import { Boolean, Messages, Output } from './common';

export function ModelCall({ messages, step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <Messages step={{ messages }} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        <Output step={step} />
      </Descriptions.Item>
      <Descriptions.Item label="model" span={1}>
        {step.model}
      </Descriptions.Item>
      <Descriptions.Item label="params" span={2}>
        <ReactJson collapsed src={step.modelParams} />
      </Descriptions.Item>
      <Descriptions.Item label="batch" span={1}>
        <Boolean step={step.isBatch} />
      </Descriptions.Item>
    </Descriptions>
  );
}
