import React from 'react';
import { Descriptions, Space, Typography } from 'antd';

import { JsonView } from '../../../components/JsonView';
import { getInput } from '../../../utils';

export function ToolCalls({ step, title }) {
  const args = JSON.parse(step.call?.arguments || '{}');
  const input = getInput(args);
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item label="tool" span={3}>
        {step.call?.name}
      </Descriptions.Item>
      <Descriptions.Item label="input" span={3}>
        <Space direction="vertical" size="middle">
          {input ?
            <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
              {input}
            </Typography.Paragraph>
            : null
          }
          <JsonView src={args} />
        </Space>
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        {step.response}
      </Descriptions.Item>
    </Descriptions>
  );
}
