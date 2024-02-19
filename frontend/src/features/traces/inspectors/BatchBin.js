import React from 'react';
import { Descriptions } from 'antd';

export function BatchBin({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="bin">
        {step.bin}
      </Descriptions.Item>
      <Descriptions.Item span={3} label="size">
        {step.size}
      </Descriptions.Item>
    </Descriptions>
  );
}
