import React from 'react';
import { Descriptions, Space, Typography } from 'antd';

import { JsonView } from '../../../components/JsonView';
import { Input } from './common';

export function PromptEnrichment({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <Input step={step} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        <Space direction="vertical" size="middle">
          {step.enrichedArgs?.context ?
            <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
              {step.enrichedArgs.context}
            </Typography.Paragraph>
            : null
          }
          <JsonView src={step.enrichedArgs} />
        </Space>
      </Descriptions.Item>
    </Descriptions>
  );
}
