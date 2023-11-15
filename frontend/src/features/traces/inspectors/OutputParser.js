import React from 'react';
import { Descriptions, Typography } from 'antd';
import ReactJson from 'react-json-view';

export function OutputParser({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
          {step.input?.choices[0].message.content}
        </Typography.Paragraph>
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        {step.outputParser === 'json' ?
          <ReactJson src={JSON.parse(step.output?.choices[0].message.content)} />
          :
          <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
            {step.output?.choices[0].message.content}
          </Typography.Paragraph>
        }
      </Descriptions.Item>
      <Descriptions.Item label="parser" span={1}>
        {step.outputParser}
      </Descriptions.Item>
    </Descriptions>
  );
}
