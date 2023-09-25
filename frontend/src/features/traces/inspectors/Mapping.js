import React from 'react';
import { Descriptions } from 'antd';
import ReactJson from 'react-json-view';

import { MappingTemplate, Source } from './common';

export function Mapping({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <ReactJson collapsed src={step.input} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        <ReactJson collapsed src={step.output} />
      </Descriptions.Item>
      {step.source ?
        <Descriptions.Item span={3} label="source">
          <Source step={step} />
        </Descriptions.Item>
        : null
      }
      {step.mappingTemplate ?
        <Descriptions.Item span={3} label="mapping template">
          <MappingTemplate step={step} />
        </Descriptions.Item>
        : null
      }
    </Descriptions>
  );
}
