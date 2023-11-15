import React from 'react';
import { Descriptions, Typography } from 'antd';

import { Output } from './common';

export function OutputProcessing({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
          {step.input?.choices[0].message.content}
        </Typography.Paragraph>
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        <Output step={step} />
      </Descriptions.Item>
    </Descriptions>
  );
}
