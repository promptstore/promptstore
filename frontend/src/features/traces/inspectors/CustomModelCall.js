import React from 'react';
import { Descriptions } from 'antd';

import { JsonView } from '../../../components/JsonView';

export function CustomModelCall({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <JsonView src={step.args} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        <JsonView src={step.response} />
      </Descriptions.Item>
      <Descriptions.Item label="model" span={1}>
        {step.model}
      </Descriptions.Item>
      <Descriptions.Item label="params" span={2}>
        <JsonView src={step.modelParams} />
      </Descriptions.Item>
      {step.url ?
        <Descriptions.Item label="url" span={3}>
          {step.url}
        </Descriptions.Item>
        : null
      }
      {step.batchEndpoint ?
        <Descriptions.Item label="batch endpoint" span={3}>
          {step.batchEndpoint}
        </Descriptions.Item>
        : null
      }
    </Descriptions>
  );
}
