import React from 'react';
import { Button, Dropdown, Space } from 'antd';
// import { MinusOutlined, PlusOutlined } from '@ant-design/icons';

export function ActionsColumn({
  editRow,
  generateCopyImage,
  increaseLength,
  record,
  reduceLength,
  refine,
  showVersionsModal,
  submitForReview,
  userData,
}) {

  return (
    <Space direction="vertical" size="small" className="row-actions">
      <Space direction="horizontal" size="small">
        <Button type="text" size="small"
          onClick={() => generateCopyImage(record.key)}
        >
          Generate Image
        </Button>
        {/* <Space.Compact direction="horizontal" size="small">
          <div style={{ cursor: 'default', fontSize: '12px', lineHeight: '24px' }}>Length:</div>
          <Button.Group>
            <Button type="text" size="small"
              icon={<MinusOutlined />}
              onClick={() => reduceLength(record.key)}
            />
            <Button type="text" size="small"
              icon={<PlusOutlined />}
              onClick={() => increaseLength(record.key)}
            />
          </Button.Group>
        </Space.Compact> */}
      </Space>
      <Space direction="horizontal" size="small">
        <Button type="text" size="small"
          onClick={() => generateCopyImage(record.key)}
        >
          Generate Variations
        </Button>
      </Space>
      <Space direction="horizontal" size="small">
        <Button type="text" size="small"
          onClick={() => editRow(record.key)}
        >
          Edit
        </Button>
        <Button type="text" size="small"
          onClick={() => showVersionsModal(record.key)}
        >
          Versions
        </Button>
      </Space>
      <Space direction="horizontal" size="small">
        <Button type="text" size="small"
          onClick={() => refine(record.key)}
        >
          Refine
        </Button>
        <Dropdown
          menu={{
            items: userData,
            onClick: ({ key }) => submitForReview(record.key, key),
          }}
          placement="bottomLeft"
          arrow
        >
          <Button type="text" size="small">
            Submit for Review
          </Button>
        </Dropdown>
      </Space>
    </Space>
  );
}