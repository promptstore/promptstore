import React from 'react';
import { Descriptions } from 'antd';

import { formatCurrency } from '../../../utils';

export function AppView({ app }) {

  if (!app) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    )
  }
  return (
    <Descriptions
      title="App Features"
      layout="vertical"
      column={1}
      colon={false}
      labelStyle={{ color: '#888' }}
      contentStyle={{ paddingBottom: 16 }}
      style={{ color: 'rgb(204, 204, 204)', padding: '10px 15px' }}
    >
      {app.features?.format ?
        <Descriptions.Item label="Format">
          {app.features.format}
        </Descriptions.Item>
        : null
      }
      {app.features?.journey ?
        <Descriptions.Item label="Journey">
          {app.features.journey}
        </Descriptions.Item>
        : null
      }
      {app.features?.needState ?
        <Descriptions.Item label="Need State">
          {app.features.needState}
        </Descriptions.Item>
        : null
      }
      {app.features?.productCategory ?
        <Descriptions.Item label="Product Category">
          {app.features.productCategory}
        </Descriptions.Item>
        : null
      }
      {app.features?.product ?
        <Descriptions.Item label="Product">
          {app.features.product}
        </Descriptions.Item>
        : null
      }
      {app.features?.style ?
        <Descriptions.Item label="Style">
          {app.features.style}
        </Descriptions.Item>
        : null
      }
      {app.features?.usp && app.features.usp.length ?
        <Descriptions.Item label="Unique Selling Points">
          <ul>
            {app.features.usp.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </Descriptions.Item>
        : null
      }
      {app.cost ?
        <Descriptions.Item label="Cumulative Cost">
          {formatCurrency(app.cost)}
        </Descriptions.Item>
        : null
      }
    </Descriptions>
  );
}