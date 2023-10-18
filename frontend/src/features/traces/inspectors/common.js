import React from 'react';
import { Space, Typography } from 'antd';
import ReactJson from 'react-json-view';

import { getInputString, hashStr } from '../../../utils';

function Choices({ step }) {
  return (
    <div>
      {step.response?.choices?.map((choice, i) => (
        choice.message.function_call ?
          <div key={'output-' + i}>
            <div>name: {choice.message.function_call.name}</div>
            <div>arguments: <ReactJson collapsed src={JSON.parse(choice.message.function_call.arguments)} /></div>
          </div>
          :
          <div key={'output-' + i}>
            <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
              {choice.message.content}
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              finish reason: {choice.finish_reason}
            </Typography.Text>
          </div>
      ))}
    </div>
  );
}

function Errors({ step }) {
  return (
    <div>
      {step.errors?.map((err, i) => (
        <div key={hashStr(err.message)}>
          <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
            {err.message}
          </Typography.Paragraph>
          {err.stack ?
            <Typography.Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
              {err.stack}
            </Typography.Text>
            : null
          }
        </div>
      ))}
    </div>
  );
}

export function Input({ step }) {
  const input = getInputString(step.args);
  return (
    <Space direction="vertical" size="middle">
      {input ?
        <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
          {input}
        </Typography.Paragraph>
        : null
      }
      <ReactJson collapsed src={step.args} />
    </Space>
  )
}

export function Output({ step }) {
  return step.errors ?
    <Errors step={step} />
    : (
      step.response?.choices ?
        <Choices step={step} />
        :
        <ReactJson src={step.response} />
    )
}

export function OutputMultiple({ step }) {
  return step.errors ?
    <Errors step={step} />
    : (
      <div>
        {step.response?.map(r => (
          <Space direction="vertical" style={{ marginBottom: 24 }}>
            <div>
              <Typography.Paragraph className="first" style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>
                {r.model}
              </Typography.Paragraph>
              <Typography.Text type="secondary">
                model
              </Typography.Text>
            </div>
            <Choices step={{ response: r }} />
          </Space>
        ))}
      </div>
    )
}

export function Messages({ step }) {
  const messages = step.messages || step.prompt?.messages || [];
  return (
    <div>
      {messages.map((message, i) => (
        <div key={hashStr(message.content)}>
          <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Typography.Paragraph>
          <Typography.Text type="secondary">
            role: {message.role}
          </Typography.Text>
        </div>
      ))}
    </div>
  );
}

export function MappingTemplate({ step }) {
  return (
    <div style={{ color: 'rgb(0, 43, 54)', fontFamily: 'monospace', whiteSpace: 'pre' }}>
      {String(step.mappingTemplate).split('\n').map((line) => (
        <div key={hashStr(line)}>{line}</div>
      ))}
    </div>
  );
}

export function Prompt({ step }) {
  return (
    <div>
      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
        {step.prompt}
      </Typography.Paragraph>
      <Typography.Text type="secondary">
        Prompt
      </Typography.Text>
    </div>
  );
}

export function Plan({ step }) {
  return (
    <ol>
      {step.plan?.map((step) => (
        <li key={hashStr(step)}>
          {step}
        </li>
      ))}
    </ol>
  );
}

export function Source({ step }) {
  return step.source.type + (step.source.name ? ':' + step.source.name : '');
}

export function Tools({ step }) {
  return (
    <ul>
      {step.allowedTools?.map((tool) => (
        <li key={tool}>{tool}</li>
      ))}
    </ul>
  );
}

export function Boolean({ value }) {
  return value ? 'Yes' : 'No';
}
