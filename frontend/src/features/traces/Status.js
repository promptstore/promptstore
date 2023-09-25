import React from 'react';
import { Descriptions, Typography } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons';
import * as dayjs from 'dayjs';

import { TIME_FORMAT } from './common';

export function Status({ step, username }) {
  return (
    <Descriptions className="trace-status" title="Status" column={1} layout="vertical">
      <Descriptions.Item label="user">
        {username}
      </Descriptions.Item>
      <Descriptions.Item label="start">
        {dayjs(step.startTime).format(TIME_FORMAT)}
      </Descriptions.Item>
      <Descriptions.Item label="end">
        {dayjs(step.endTime).format(TIME_FORMAT)}
      </Descriptions.Item>
      {step.elapsedMillis ?
        <Descriptions.Item label="latency">
          {step.elapsedMillis} ms
        </Descriptions.Item>
        : null
      }
      <Descriptions.Item label="status">
        {step.success || step.valid || !step.errors ?
          <div className="success">
            <CheckCircleFilled />
            Success
          </div>
          :
          <div>
            <CloseCircleFilled />
            Error
          </div>
        }
      </Descriptions.Item>
      {step.errors?.length ?
        <Descriptions.Item label="errors">
          {step.errors.map((err, i) => (
            <Typography.Paragraph key={'err-' + i}>
              {err.message}
            </Typography.Paragraph>
          ))}
        </Descriptions.Item>
        : null
      }
      {step.response?.usage ?
        <>
          <Descriptions.Item label="prompt tokens">
            {step.response.usage.prompt_tokens}
          </Descriptions.Item>
          <Descriptions.Item label="completion tokens">
            {step.response.usage.completion_tokens}
          </Descriptions.Item>
          <Descriptions.Item label="total tokens">
            {step.response.usage.total_tokens}
          </Descriptions.Item>
        </>
        : null
      }
    </Descriptions>
  );
}
