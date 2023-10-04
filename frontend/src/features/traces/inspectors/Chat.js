import React from 'react';
import { Descriptions } from 'antd';

import { Input, OutputMultiple } from './common';

export function Chat({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <Input step={step} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        <OutputMultiple step={step} />
      </Descriptions.Item>
    </Descriptions>
  );
}
