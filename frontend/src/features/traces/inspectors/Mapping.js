import React from 'react';
import { Descriptions } from 'antd';

import { JsonView } from '../../../components/JsonView';
import { MappingTemplate, Source } from './common';

export function Mapping({ step, title }) {
  return (
    <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
      <Descriptions.Item span={3} label="input">
        <JsonView src={step.input} />
      </Descriptions.Item>
      <Descriptions.Item span={3} label="output">
        <JsonView src={step.output} />
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
