import React from 'react';
import { Descriptions, Tag } from 'antd';

import AngryEmoji from '../../images/emojis/emoji-angry.png';

export function Governance({ step }) {
  return (
    <Descriptions className="trace-status" title="Governance" column={1} layout="vertical" style={{ backgroundColor: '#fff' }}>
      <Descriptions.Item label="PII mentions">
        <div>
          <p><Tag>PER</Tag> Jane Doe</p>
          <p><Tag>ORG</Tag> Acme Corp.</p>
        </div>
      </Descriptions.Item>
      <Descriptions.Item label="emotion">
        <img src={AngryEmoji} alt="Angry Emoji" title="Angry" style={{ width: 32 }} />
      </Descriptions.Item>
      <Descriptions.Item label="moderation category">
        Potential Harassment
      </Descriptions.Item>
      <Descriptions.Item label="clarity">
        Good
      </Descriptions.Item>
      <Descriptions.Item label="succinctness">
        Average
      </Descriptions.Item>
      <Descriptions.Item label="confidential mentions">
        <div>
          <p>Financial information</p>
        </div>
      </Descriptions.Item>
      <Descriptions.Item label="IP mentions">
        <div>
          <p>Product information</p>
        </div>
      </Descriptions.Item>
    </Descriptions>
  );
}
