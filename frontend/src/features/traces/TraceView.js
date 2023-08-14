import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { Col, Descriptions, Row, Space, Tag, Tree, Typography } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons';
import { DownOutlined } from '@ant-design/icons';
import ReactJson from 'react-json-view';
import * as dayjs from 'dayjs';

import NavbarContext from '../../contexts/NavbarContext';
import { getInputString, hashStr } from '../../utils';

import {
  getTraceAsync,
  selectLoaded,
  selectTraces,
} from './tracesSlice';

import AngryEmoji from '../../images/emojis/emoji-angry.png';

const TIME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

export function TraceView() {

  const [selectedKeys, setSelectedKeys] = useState(['call-function']);

  const traces = useSelector(selectTraces);
  const loaded = useSelector(selectLoaded);

  const { setNavbarState } = useContext(NavbarContext);

  const dispatch = useDispatch();
  const location = useLocation();

  const id = location.pathname.match(/\/traces\/(.*)/)[1];
  const trace = traces[id];

  const step = useMemo(() => {
    const inner = (trace) => {
      for (const step of trace) {
        if (step.type === selectedKeys[0]) {
          const node = { ...step };
          delete node.children;
          return node;
        }
        if (step.children) {
          const match = inner(step.children);
          if (match) {
            return match;
          }
        }
      }
      return null;
    }

    if (trace && selectedKeys.length) {
      return inner(trace.trace);
    }
    return null;

  }, [selectedKeys, trace]);

  const getTitle = (step) => {
    if (step.type === 'call-function') {
      return step.type + ' - ' + step.function;
    }
    return step.type;
  };

  const treeData = useMemo(() => {
    if (trace) {
      const inner = (t, lvl = '') => {
        return t.map((step, i) => {
          let j = i + 1;
          if (step.children) {
            let num = lvl ? lvl + '.' + j : j;
            return {
              title: getTitle(step),
              key: step.type + '-' + num,
              type: step.type,
              children: inner(step.children, num),
            };
          }
          let num = lvl ? lvl + '.' + j : j;
          return {
            title: getTitle(step),
            key: step.type + '-' + num,
            type: step.type,
          };
        });
      }

      return inner(trace.trace);
    }
  }, [trace]);

  console.log('treeData:', treeData);

  useEffect(() => {
    dispatch(getTraceAsync(id));
  }, []);

  useEffect(() => {
    if (trace) {
      const name = trace.name;
      const parts = name.split(' - ');
      const title = parts[0] + ' - ' + dayjs(parts[1]).format(TIME_FORMAT);
      setNavbarState((state) => ({
        ...state,
        createLink: null,
        title,
      }));
    }
  }, [trace]);

  const onSelect = (selectedKeys, info) => {
    console.log('selected', selectedKeys, info);
    setSelectedKeys([info.node.type]);
  };

  function Step({ step }) {
    if (!step) {
      return (
        <div></div>
      );
    }
    if (step.type === 'call-function' || step.type === 'call-implementation') {
      const title = step.type === 'call-function' ? 'Call Function' : 'Call Implementation';
      const input = getInputString(step.args);
      return (
        <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
            <Space direction="vertical" size="middle">
              {input ?
                <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
                  {input}
                </Typography.Paragraph>
                : null
              }
              <ReactJson collapsed src={step.args} />
            </Space>
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            {step.response?.choices ?
              <div>
                {step.response.choices.map((choice, i) => (
                  <div key={hashStr(choice.message.content)}>
                    <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
                      {choice.message.content}
                    </Typography.Paragraph>
                    <Typography.Text type="secondary">
                      finish reason: {choice.finish_reason}
                    </Typography.Text>
                  </div>
                ))}
              </div>
              : null
            }
            {step.errors ?
              <div>
                {step.errors.map((err, i) => (
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
              : null
            }
          </Descriptions.Item>
          <Descriptions.Item label="model" span={1}>
            {step.implementation.model}
          </Descriptions.Item>
          <Descriptions.Item label="params" span={2}>
            <ReactJson collapsed src={step.implementation.modelParams} />
          </Descriptions.Item>
          <Descriptions.Item label="batch" span={1}>
            {step.isBatch ? 'Yes' : 'No'}
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (step.type === 'validate-args') {
      return (
        <Descriptions className="trace-step" title="Validate Args" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
            <ReactJson collapsed src={step.instance} />
          </Descriptions.Item>
          <Descriptions.Item span={3} label="schema">
            <ReactJson collapsed src={step.schema} />
          </Descriptions.Item>
          <Descriptions.Item label="valid" span={1}>
            {step.valid ? 'Yes' : 'No'}
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (step.type === 'map-args') {
      return (
        <Descriptions className="trace-step" title="Map Args" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
            <ReactJson collapsed src={step.input.values} />
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            <ReactJson collapsed src={step.output.values} />
          </Descriptions.Item>
          {step.mappingTemplate ?
            <Descriptions.Item span={3} label="mapping template">
              <div>
                {String(step.mappingTemplate).split('\n').map((line) => (
                  <div key={hashStr(line)}>{line}</div>
                ))}
              </div>
            </Descriptions.Item>
            : null
          }
        </Descriptions>
      );
    } else if (step.type === 'enrichment-pipeline' || step.type === 'call-prompt-template') {
      const title = step.type === 'enrichment-pipeline' ? 'Enrichment Pipeline' : 'Call Prompt Template';
      const input = getInputString(step.args);
      return (
        <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
            <Space direction="vertical" size="middle">
              {input ?
                <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
                  {input}
                </Typography.Paragraph>
                : null
              }
              <ReactJson collapsed src={step.args} />
            </Space>
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            <div>
              {step.messages.map((message, i) => (
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
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (step.type === 'call-model') {
      return (
        <Descriptions className="trace-step" title="Call GPT Model" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
            <div>
              {step.messages.map((message, i) => (
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
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            <div>
              {step.response.choices.map((choice, i) => (
                <div key={hashStr(choice.message.content)}>
                  <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
                    {choice.message.content}
                  </Typography.Paragraph>
                  <Typography.Text type="secondary">
                    finish reason: {choice.finish_reason}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="model" span={1}>
            {step.model}
          </Descriptions.Item>
          <Descriptions.Item label="params" span={2}>
            <ReactJson collapsed src={step.modelParams} />
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (step.type === 'call-custom-model') {
      return (
        <Descriptions className="trace-step" title="Call Custom Model" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
            <ReactJson collapsed src={step.args} />
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            <ReactJson collapsed src={step.response} />
          </Descriptions.Item>
          <Descriptions.Item label="model" span={1}>
            {step.model}
          </Descriptions.Item>
          <Descriptions.Item label="params" span={2}>
            <ReactJson collapsed src={step.modelParams} />
          </Descriptions.Item>
          {step.url ?
            <Descriptions.Item label="url" span={3}>
              {step.url}
            </Descriptions.Item>
            : null
          }
          {step.batchEndpoint ?
            <Descriptions.Item label="batch endpoint" span={3}>
              {step.batchEndpoint}
            </Descriptions.Item>
            : null
          }
        </Descriptions>
      );
    } else if (step.type === 'plan-and-execute agent') {
      return (
        <Descriptions className="trace-step" title="Plan and Execute" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="agent">
            {step.callParams.agentName}
          </Descriptions.Item>
          <Descriptions.Item span={3} label="goal">
            {step.goal}
          </Descriptions.Item>
          <Descriptions.Item span={1} label="allowed tools">
            <ul>
              {step.allowedTools.map((tool) => (
                <li key={tool}>{tool}</li>
              ))}
            </ul>
          </Descriptions.Item>
          <Descriptions.Item label="call params" span={2}>
            <ReactJson collapsed src={step.callParams} />
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (step.type === 'call-model: plan') {
      return (
        <Descriptions className="trace-step" title="Call Model - Plan" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
            <div>
              {step.messages.map((message, i) => (
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
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            <div>
              {step.response.choices.map((choice, i) => (
                <div key={hashStr(choice.message.content)}>
                  <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
                    {choice.message.content}
                  </Typography.Paragraph>
                  <Typography.Text type="secondary">
                    finish reason: {choice.finish_reason}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="plan" span={3}>
            <ol>
              {step.plan.map((step) => (
                <li key={hashStr(step)}>
                  {step}
                </li>
              ))}
            </ol>
          </Descriptions.Item>
          <Descriptions.Item label="model" span={1}>
            {step.model}
          </Descriptions.Item>
          <Descriptions.Item label="params" span={2}>
            <ReactJson collapsed src={step.modelParams} />
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (step.type === 'execute-plan') {
      return (
        <Descriptions className="trace-step" title="Execute Plan" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item label="plan" span={3}>
            <ol>
              {step.plan.map((step) => (
                <li key={hashStr(step)}>
                  {step}
                </li>
              ))}
            </ol>
          </Descriptions.Item>
          <Descriptions.Item span={3} label="response">
            <div>
              {step.response.choices.map((choice, i) => (
                <div key={hashStr(choice.message.content)}>
                  <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
                    {choice.message.content}
                  </Typography.Paragraph>
                  <Typography.Text type="secondary">
                    finish reason: {choice.finish_reason}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (step.type === 'evaluate-step') {
      return (
        <Descriptions className="trace-step" title="Evaluate Step" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item label="model" span={3}>
            {step.step}
          </Descriptions.Item>
          <Descriptions.Item span={3} label="input">
            <div>
              {step.messages.map((message, i) => (
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
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            {step.response.choices ?
              <div>
                {step.response.choices.map((choice, i) => (
                  <>
                    {choice.message.function_call ?
                      <div>
                        <div>name: {choice.message.function_call.name}</div>
                        <div>arguments: <ReactJson collapsed src={JSON.parse(choice.message.function_call.arguments)} /></div>
                      </div>
                      :
                      <div key={hashStr(choice.message.content)}>
                        <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
                          {choice.message.content}
                        </Typography.Paragraph>
                        <Typography.Text type="secondary">
                          finish reason: {choice.finish_reason}
                        </Typography.Text>
                      </div>
                    }
                  </>
                ))}
              </div>
              :
              <ReactJson collapsed src={step.response} />
            }
          </Descriptions.Item>
          <Descriptions.Item label="model" span={1}>
            {step.model}
          </Descriptions.Item>
          <Descriptions.Item label="params" span={2}>
            <ReactJson collapsed src={step.modelParams} />
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (step.type === 'call-tool') {
      return (
        <Descriptions className="trace-step" title="Call Tool" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item label="tool" span={3}>
            {step.call.name}
          </Descriptions.Item>
          <Descriptions.Item label="input" span={3}>
            <ReactJson collapsed src={JSON.parse(step.call.arguments)} />
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            {step.response}
          </Descriptions.Item>
          <Descriptions.Item label="model" span={1}>
            {step.model}
          </Descriptions.Item>
          <Descriptions.Item label="params" span={2}>
            <ReactJson collapsed src={step.modelParams} />
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (step.type === 'call-model: observe') {
      return (
        <Descriptions className="trace-step" title="Call Model - Observe" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
            <div>
              {step.messages.map((message, i) => (
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
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            <div>
              {step.response.choices.map((choice, i) => (
                <div key={hashStr(choice.message.content)}>
                  <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
                    {choice.message.content}
                  </Typography.Paragraph>
                  <Typography.Text type="secondary">
                    finish reason: {choice.finish_reason}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="model" span={1}>
            {step.model}
          </Descriptions.Item>
          <Descriptions.Item label="params" span={2}>
            <ReactJson collapsed src={step.modelParams} />
          </Descriptions.Item>
        </Descriptions>
      );
    } else if (step.type === 'semantic-search-enrichment' || step.type === 'feature-store-enrichment' || step.type === 'function-enrichment' || step.type === 'sql-enrichment') {
      let title;
      switch (step.type) {
        case 'semantic-search-enrichment':
          title = 'Enrich Context using Semantic Search';
          break;

        case 'feature-store-enrichment':
          title = 'Enrich Context using a Feature Store';
          break;

        case 'function-enrichment':
          title = 'Enrich Context using a Semantic Function';
          break;

        case 'sql-enrichment':
          title = 'Enrich Context using a SQL Source';
          break;

        default:

      }
      const input = getInputString(step.args);
      return (
        <Descriptions className="trace-step" title={title} column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
            <Space direction="vertical" size="middle">
              {input ?
                <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
                  {input}
                </Typography.Paragraph>
                : null
              }
              <ReactJson collapsed src={step.args} />
            </Space>
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            <Space direction="vertical" size="middle">
              {step.enrichedArgs?.context ?
                <Typography.Paragraph className="first" style={{ whiteSpace: 'pre-wrap' }}>
                  {step.enrichedArgs.context}
                </Typography.Paragraph>
                : null
              }
              <ReactJson collapsed src={step.enrichedArgs} />
            </Space>
          </Descriptions.Item>
        </Descriptions>
      );
    }
    return (
      <ReactJson src={step} />
    );
  }

  function Status({ step, username }) {
    if (!step) {
      return (
        <div></div>
      );
    }
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
            {step.errors.map((err) => (
              <Typography.Paragraph>
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

  function Governance({ step }) {
    if (!step) {
      return (
        <div></div>
      );
    }
    return (
      <Descriptions className="trace-status" title="Governance" column={1} layout="vertical" style={{ backgroundColor: '#fff' }}>
        <Descriptions.Item label="PII mentions">
          <div>
            <p><Tag>PER</Tag> Jane Doe</p>
            <p><Tag>ORG</Tag> Acme Corp.</p>
          </div>
        </Descriptions.Item>
        <Descriptions.Item label="emotion">
          <img src={AngryEmoji} title="Angry" style={{ width: 32 }} />
        </Descriptions.Item>
        <Descriptions.Item label="moderation category">
          Potential Harassment
        </Descriptions.Item>
        <Descriptions.Item label="clarity">
          Good
        </Descriptions.Item>
        <Descriptions.Item label="succinctness">
          Average
        </Descriptions.Item>
        <Descriptions.Item label="confidential mentions">
          <div>
            <p>Financial information</p>
          </div>
        </Descriptions.Item>
        <Descriptions.Item label="IP mentions">
          <div>
            <p>Product information</p>
          </div>
        </Descriptions.Item>
      </Descriptions>
    );
  }

  if (!loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <div style={{ marginTop: 20 }}>
      <Row gutter={16}>
        <Col span={6}>
          <Descriptions className="trace" title="Trace" column={1} layout="vertical">
            <Descriptions.Item span={1}>
              <Tree
                showLine
                switcherIcon={<DownOutlined />}
                onSelect={onSelect}
                treeData={treeData}
                style={{ padding: '10px 15px' }}
                defaultExpandAll={true}
              />
            </Descriptions.Item>
          </Descriptions>
        </Col>
        <Col span={10}>
          <Step step={step} />
        </Col>
        <Col span={4}>
          <Governance step={step} />
        </Col>
        <Col span={4}>
          <Status step={step} username={trace.createdBy} />
        </Col>
      </Row>
    </div>
  );
}
