import React from 'react';
import { Image, Space, Typography } from 'antd';

import { JsonView } from '../../../components/JsonView';
import { decodeEntities, getInput, hashStr } from '../../../utils';

function Choices({ step }) {
  return (
    <div>
      {step.response?.choices?.map((choice, i) =>
        choice.message.function_call ? (
          <div key={'output-' + i}>
            <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
              <div>name: {choice.message.function_call.name}</div>
              <div>
                arguments: <JsonView src={choice.message.function_call.arguments} />
              </div>
            </Typography.Paragraph>
            <Typography.Text type="secondary">function call</Typography.Text>
          </div>
        ) : choice.message.tool_calls ? (
          choice.message.tool_calls.map((call, j, arr) => (
            <div key={`output-${i}-$[{j}`} style={{ marginTop: j > 0 ? 16 : 0 }}>
              <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
                <div>name: {call.function.name}</div>
                <div>
                  arguments: <JsonView src={call.function.arguments} />
                </div>
              </Typography.Paragraph>
              <Typography.Text type="secondary">tool call{arr.length ? ` ${j + 1}` : ''}</Typography.Text>
            </div>
          ))
        ) : (
          <div key={'output-' + i}>
            <Content content={choice.message.content} />
            {/* <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
              {typeof choice.message.content === 'string' ?
                decodeEntities(choice.message.content)
                :
                JSON.stringify(choice.message.content)
              }
            </Typography.Paragraph> */}
            {choice.finish_reason ? (
              <Typography.Text type="secondary">finish reason: {choice.finish_reason}</Typography.Text>
            ) : null}
          </div>
        )
      )}
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
          {err.stack ? (
            <Typography.Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
              {err.stack}
            </Typography.Text>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Content({ content }) {
  if (Array.isArray(content)) {
    return content.map((c, i) => {
      if (!c) {
        return (
          <div key={'content-' + i}>
            <Typography.Paragraph className={i === 0 ? 'first' : ''}>None</Typography.Paragraph>
          </div>
        );
      }
      if (typeof c === 'string') {
        return (
          <div key={'content-' + i}>
            <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
              {decodeEntities(c)}
            </Typography.Paragraph>
          </div>
        );
      }
      if (c.type === 'image_url') {
        return (
          <div key={'content-' + i} style={{ marginBottom: 16 }}>
            <Image src={c.image_url.url} width={200} />
          </div>
        );
      }
      return (
        <div key={'content-' + i}>
          <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
            {decodeEntities(c.text)}
          </Typography.Paragraph>
        </div>
      );
    });
  }
  return (
    <div>
      <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
        {decodeEntities(content)}
      </Typography.Paragraph>
    </div>
  );
}

export function Input({ step }) {
  let input;
  if (step.args) {
    input = getInput(step.args, step.isBatch);
  } else if (step.messages?.length) {
    input = step.messages[step.messages.length - 1].content;
  }
  return (
    <Space direction="vertical" size="middle">
      {input ? <Content content={input} /> : null}
      {step.args ? <JsonView src={step.args} /> : null}
    </Space>
  );
}

export function Output({ step }) {
  return step.errors ? (
    <Errors step={step} />
  ) : step.response?.choices ? (
    <Choices step={step} />
  ) : (
    <JsonView src={step.response} />
  );
}

export function OutputMultiple({ step }) {
  return step.errors ? (
    <Errors step={step} />
  ) : (
    <Space wrap size="large">
      {step.response?.map(r => (
        <Space key={r.model} direction="vertical" size="middle" style={{ marginBottom: 24 }}>
          <div>
            <Typography.Paragraph className="first" style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>
              {r.model}
            </Typography.Paragraph>
            <Typography.Text type="secondary">model</Typography.Text>
          </div>
          <Choices step={{ response: r }} />
        </Space>
      ))}
    </Space>
  );
}

export function Messages({ step }) {
  const messages = step.messages || step.prompt?.messages || [];
  return (
    <div>
      {messages.map((message, i) => (
        <div key={'msg-' + i}>
          {Array.isArray(message.content) ? (
            <>
              {message.content.map((c, j) => (
                <div key={`mc-${i}-${j}`} style={{ marginLeft: 16 }}>
                  {c.type === 'text' ? (
                    <>
                      <div className="ant-descriptions-item-label">Text</div>
                      <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
                        {decodeEntities(c.text)}
                      </Typography.Paragraph>
                    </>
                  ) : c.type === 'image_url' ? (
                    <>
                      <div className="ant-descriptions-item-label">Image</div>
                      <div style={{ marginBottom: 16 }}>
                        <Image src={c.image_url.url} width={200} />
                      </div>
                    </>
                  ) : (
                    <JsonView src={c} />
                  )}
                </div>
              ))}
              <Typography.Text type="secondary">role: {message.role}</Typography.Text>
            </>
          ) : (
            <>
              <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
                {decodeEntities(message.content)}
              </Typography.Paragraph>
              <Typography.Text type="secondary">role: {message.role}</Typography.Text>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function MappingTemplate({ step }) {
  return (
    <div style={{ color: 'rgb(0, 43, 54)', fontFamily: 'monospace', whiteSpace: 'pre' }}>
      {String(step.mappingTemplate)
        .split('\n')
        .map(line => (
          <div key={hashStr(line)}>{line}</div>
        ))}
    </div>
  );
}

export function Prompt({ step }) {
  return (
    <div>
      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{step.prompt}</Typography.Paragraph>
      <Typography.Text type="secondary">Prompt</Typography.Text>
    </div>
  );
}

export function Plan({ step }) {
  return (
    <ol>
      {step.plan?.map(step => (
        <li key={hashStr(step)}>{step}</li>
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
      {step.allowedTools?.map(tool => (
        <li key={tool}>{tool}</li>
      ))}
    </ul>
  );
}

export function Boolean({ value }) {
  return value ? 'Yes' : 'No';
}
