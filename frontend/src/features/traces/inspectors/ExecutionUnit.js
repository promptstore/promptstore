import React from 'react';
import { Descriptions } from 'antd';

import { JsonView } from '../../../components/JsonView';
import { Boolean, Input, Output } from './common';

export function ExecutionUnit({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <Input step={step} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        <Output step={step} />
      </Descriptions.Item>
      {step.type === 'call-implementation' ?
        <>
          <Descriptions.Item label="provider" span={1}>
            {step.implementation.model.provider}
          </Descriptions.Item>
          <Descriptions.Item label="model" span={1}>
            {step.implementation.model.model}
          </Descriptions.Item>
          <Descriptions.Item label="params" span={2}>
            <JsonView src={step.implementation.modelParams} />
          </Descriptions.Item>
        </>
        : null
      }
      <Descriptions.Item label="batch" span={1}>
        <Boolean value={step.isBatch} />
      </Descriptions.Item>
    </Descriptions>
  );
}
