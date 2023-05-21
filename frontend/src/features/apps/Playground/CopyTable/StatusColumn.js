import React from 'react';
import { Space, Tag } from 'antd';

const getApprovalStatusColor = (status) => {
  switch (status) {
    case 'Approved':
      return 'green';

    case 'Rejected':
      return 'red';

    default:
      return 'blue';
  }
};

export function StatusColumn({ approvalStatus, saveStatus }) {
  return (
    <Space direction="vertical" size="small">
      <Tag key={saveStatus}
        color={saveStatus === 'Saved' ? 'blue' : 'red'}
      >
        {saveStatus}
      </Tag>
      {approvalStatus ?
        <Tag key={approvalStatus}
          color={getApprovalStatusColor(approvalStatus)}
        >
          {approvalStatus}
        </Tag>
        : null
      }
    </Space>
  );
}