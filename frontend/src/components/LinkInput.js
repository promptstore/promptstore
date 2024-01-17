import React from 'react';
import { Button } from 'antd';
import { LinkOutlined } from '@ant-design/icons';

export function LinkInput({ onChange, template, value }) {

  const handleLabelChange = (ev) => {
    onChange({ ...value, label: ev.target.value });
  };

  const handleUrlChange = (ev) => {
    onChange({ ...value, url: ev.target.value });
  };

  return (
    <div style={{ display: 'flex' }}>
      <div style={{ width: 'calc(50% - 28px)' }}>
        <Input onChange={handleLabelChange}
          value={value?.label}
        />
        <div className="ant-form-item-extra">Label</div>
      </div>
      <div style={{ marginLeft: 16, width: 'calc(50% - 28px)' }}>
        <Input onChange={handleUrlChange}
          value={value?.url}
        />
        <div className="ant-form-item-extra">Key / URL</div>
      </div>
      <Button
        type="link"
        disabled={!value?.url}
        icon={<LinkOutlined />}
        onClick={() => {
          let url;
          if (template) {
            url = template.replace('{value}', value.url);
          } else {
            url = value.url;
          }
          window.open(url, '_blank') || window.location.replace(url);
        }}
        style={{ marginLeft: 8, width: 32 }}
      />
    </div>
  );
}
