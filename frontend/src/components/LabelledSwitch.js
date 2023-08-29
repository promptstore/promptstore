import React from 'react';
import { Switch } from 'antd';

export function LabelledSwitch({ checked, label, onChange }) {
  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', height: 32, marginRight: 16 }}>
        {label}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </>
  );
}
