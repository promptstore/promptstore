import React from 'react';
import { Descriptions, Space } from 'antd';

export function Experiment({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="experiments">
        <Space direction="vertical" size="large">
          {step.experiments?.map((xp, i) =>
            <div key={'xp-' + i} style={{ display: 'flex' }}>
              <div>{xp.implementation}</div>
              <div style={{ marginLeft: 24 }}>{xp.percentage} %</div>
            </div>
          )}
        </Space>
      </Descriptions.Item>
      <Descriptions.Item span={3} label="chosen">
        {step.implementation}
      </Descriptions.Item>
    </Descriptions>
  );
}
