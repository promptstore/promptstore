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
import { createOpenAIMessages } from '../../utils/formats';
import { getInputString, hashStr } from '../../utils';

import {
  getTraceAsync,
  selectLoaded,
  selectTraces,
} from './tracesSlice';

import AngryEmoji from '../../images/emojis/emoji-angry.png';

const TIME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

export function TraceView() {

  const [selectedKeys, setSelectedKeys] = useState([]);

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
        if (step.id === selectedKeys[0]) {
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
    if (step.type === 'call-function' || step.type === 'call-composition') {
      return step.type + ' - ' + step.function;
    } else if (step.type === 'map-args' && step.source) {
      let source = step.source.type;
      if (step.source.name) {
        source += ':' + step.source.name;
      }
      return step.type + ' - ' + source;
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
              key: step.id,
              num,
              type: step.type,
              title: getTitle(step),
              children: inner(step.children, num),
            };
          }
          let num = lvl ? lvl + '.' + j : j;
          return {
            key: step.id,
            num,
            type: step.type,
            title: getTitle(step),
          };
        });
      }

      return inner(trace.trace);
    }
  }, [trace]);

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
      setSelectedKeys([trace.trace[0].id]);
    }
  }, [trace]);

  const onSelect = (selectedKeys, info) => {
    console.log('info:', info);
    const key = info.selectedNodes?.[0]?.key;
    if (key) {
      setSelectedKeys([key]);
    }
  };

  function Step({ step }) {
    if (!step) {
      return (
        <div></div>
      );
    }
    if (step.type === 'call-function' || step.type === 'call-implementation' || step.type === 'call-composition') {
      let title;
      if (step.type === 'call-function') {
        title = 'Call Function';
      } else if (step.type === 'call-implementation') {
        title = 'Call Implementation';
      } else if (step.type === 'call-composition') {
        title = 'Call Composition';
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
              : (
                step.response?.choices ?
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
                  :
                  <ReactJson src={step.response} />
              )
            }
          </Descriptions.Item>
          {step.type === 'call-implementation' ?
            <>
              <Descriptions.Item label="model" span={1}>
                {step.implementation.model}
              </Descriptions.Item>
              <Descriptions.Item label="params" span={2}>
                <ReactJson collapsed src={step.implementation.modelParams} />
              </Descriptions.Item>
            </>
            : null
          }
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
    } else if (step.type === 'map-args' || step.type === 'map-response') {
      const title = step.type === 'map-args' ? 'Map Arguments' : 'Map Response';
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
              <span>{step.source.type + (step.source.name ? ':' + step.source.name : '')}</span>
            </Descriptions.Item>
            : null
          }
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
      const messages = createOpenAIMessages(step.prompt);
      return (
        <Descriptions className="trace-step" title="Call GPT Model" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
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
            <ReactJson collapsed src={step.model_params} />
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
    } else if (step.type === 'lookup-cache') {
      return (
        <Descriptions className="trace-step" title="Lookup Cache" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="input">
            <div>
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                {step.prompt}
              </Typography.Paragraph>
              <Typography.Text type="secondary">
                Prompt
              </Typography.Text>
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
          <Descriptions.Item label="model" span={2}>
            {step.model}
          </Descriptions.Item>
          <Descriptions.Item label="hit" span={1}>
            {step.hit ? 'Yes' : 'No'}
          </Descriptions.Item>
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
              {step.messages.map((message, i) =>
                <div key={'input-' + i}>
                  <Typography.Paragraph className={i === 0 ? 'first' : ''} style={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography.Paragraph>
                  <Typography.Text type="secondary">
                    role: {message.role}
                  </Typography.Text>
                </div>
              )}
            </div>
          </Descriptions.Item>
          <Descriptions.Item span={3} label="output">
            {step.response.choices ?
              <div>
                {step.response.choices.map((choice, i) =>
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
                )}
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
    } else if (step.type === 'select-experiment') {
      return (
        <Descriptions className="trace-step" title="Select Experiment" column={{ md: 1, lg: 3 }} layout="vertical">
          <Descriptions.Item span={3} label="experiments">
            <Space direction="vertical" size="large">
              {step.experiments.map((xp, i) =>
                <div key={'xp-' + i} style={{ display: 'flex' }}>
                  <div>{xp.implementation}</div>
                  <div style={{ marginLeft: 24 }}>{xp.percentage} %</div>
                </div>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item span={3} label="chosen">
            <div>{step.implementation}</div>
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
        <Col span={14}>
          <Step step={step} />
        </Col>
        {/* <Col span={4}>
          <Governance step={step} />
        </Col> */}
        <Col span={4}>
          <Status step={step} username={trace.createdBy} />
        </Col>
      </Row>
    </div>
  );
}
