import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Dropdown, Layout, Space, Table, Tag, Typography } from 'antd';
import { BlockOutlined, DownloadOutlined, MoreOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import * as dayjs from 'dayjs';
import rehypeRaw from 'rehype-raw';
import snakeCase from 'lodash.snakecase';
import { v4 as uuidv4 } from 'uuid';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { formatNumber, getBaseURL } from '../../utils';

import {
  duplicateObjectAsync,
} from '../uploader/fileUploaderSlice';

import {
  getModelAsync,
  selectLoaded,
  selectLoading,
  selectModels,
} from './modelsSlice';

import 'reactflow/dist/style.css';

const { Content, Sider } = Layout;

export function ModelView() {

  const [correlationId, setCorrelationId] = useState(null);

  const models = useSelector(selectModels);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const id = location.pathname.match(/\/models\/(.*)/)[1];
  const model = models[id];

  // console.log('model:', model);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Model',
    }));
    dispatch(getModelAsync(id));
  }, []);

  useEffect(() => {
    if (correlationId) {
      const model = Object.values(models).find(m => m.correlationId === correlationId);
      if (model) {
        navigate(`/models/${model.id}`);
        setCorrelationId(null);
      }
    }
  }, [models]);

  const handleDuplicate = () => {
    const correlationId = uuidv4();
    dispatch(duplicateObjectAsync({
      correlationId,
      obj: model,
      type: 'model',
      workspaceId: selectedWorkspace.id,
    }));
    setCorrelationId(correlationId);
  };

  const columns = [
    {
      title: 'Variable',
      dataIndex: 'key',
      key: 'variable',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
  ];

  const data = useMemo(() => {
    if (model && model.arguments) {
      const list = Object.entries(model.arguments.properties || {}).map(([k, v]) => {
        let type;
        if (v.type === 'array') {
          type = `${v.type}[${v.items.type}]`
        } else {
          type = v.type;
        }
        return {
          key: k,
          type,
        };
      });
      list.sort((a, b) => a.key < b.key ? -1 : 1);
      return list;
    }
    return [];
  }, [model]);

  const outputData = useMemo(() => {
    if (model && model.returnTypeSchema) {
      const list = Object.entries(model.returnTypeSchema.properties || {}).map(([k, v]) => {
        let type;
        if (v.type === 'array') {
          type = `${v.type}[${v.items.type}]`
        } else {
          type = v.type;
        }
        return {
          key: k,
          type,
        };
      });
      list.sort((a, b) => a.key < b.key ? -1 : 1);
      return list;
    }
    return [];
  }, [model]);

  if (!loaded) {
    return (
      <div style={{ marginTop: 20 }}>
        Loading...
      </div>
    );
  }
  return (
    <div style={{ marginTop: 20 }}>
      <Layout>
        <Content>
          <Card title={model.name} className="model-view"
            extra={
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <Link to={`/models`}>List</Link>
                <Link to={`/models/${id}/edit`}>Edit</Link>
                <Dropdown arrow
                  className="action-link"
                  placement="bottom"
                  menu={{
                    items: [
                      {
                        key: 'duplicate',
                        icon: <BlockOutlined />,
                        label: (
                          <Link onClick={handleDuplicate}>Duplicate</Link>
                        ),
                      },
                      {
                        key: 'download',
                        icon: <DownloadOutlined />,
                        label: (
                          <Download filename={snakeCase(model?.name) + '.json'} payload={model}>
                            <Link>Export</Link>
                          </Download>
                        )
                      },
                    ]
                  }}
                >
                  <MoreOutlined />
                </Dropdown>
              </div>
            }
            loading={loading}
            style={{ minWidth: 952, width: '65%' }}
          >
            <Descriptions column={1} layout="vertical">
              <Descriptions.Item>
                <Descriptions column={6}>
                  <Descriptions.Item label="key" span={2}>
                    {model.key}
                  </Descriptions.Item>
                  <Descriptions.Item label="type" span={1}>
                    {model.type}
                  </Descriptions.Item>
                  {model.provider ?
                    <Descriptions.Item label="provider" span={3}>
                      {model.provider}
                    </Descriptions.Item>
                    :
                    <Descriptions.Item span={3} />
                  }
                </Descriptions>
              </Descriptions.Item>
              <Descriptions.Item label="description">
                <Typography.Text className="prompttext">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {model.description}
                  </ReactMarkdown>
                </Typography.Text>
              </Descriptions.Item>
              {model.type === 'gpt' || model.type === 'completion' ?
                <>
                  <Descriptions.Item>
                    <Descriptions column={3}>
                      <Descriptions.Item label="context window">
                        {formatNumber(model.contextWindow)} tokens
                      </Descriptions.Item>
                      <Descriptions.Item label="credits per call">
                        ~{formatNumber(model.creditsPerCall)}
                      </Descriptions.Item>
                    </Descriptions>
                  </Descriptions.Item>
                  <Descriptions.Item>
                    <Descriptions column={3}>
                      <Descriptions.Item label="tokens per min.">
                        {formatNumber(model.tokensPerMinute)}
                      </Descriptions.Item>
                      <Descriptions.Item label="requests per min.">
                        {formatNumber(model.requestsPerMinute)}
                      </Descriptions.Item>
                    </Descriptions>
                  </Descriptions.Item>
                  <Descriptions.Item>
                    <Descriptions column={3}>
                      <Descriptions.Item label="training date">
                        {model.trainingDate ? dayjs(model.trainingDate).format('MMMM, YYYY') : null}
                      </Descriptions.Item>
                    </Descriptions>
                  </Descriptions.Item>
                </>
                : null
              }
              {model.isPublic || model.disabled || model.tags?.length ?
                <Descriptions.Item>
                  <Descriptions column={6}>
                    {model.isPublic ?
                      <Descriptions.Item span={1}>
                        <Tag color="#f50">Public</Tag>
                      </Descriptions.Item>
                      : null
                    }
                    {model.disabled ?
                      <Descriptions.Item span={1}>
                        <Tag color="#2db7f5">Disabled</Tag>
                      </Descriptions.Item>
                      : null
                    }
                    {model.tags?.length ?
                      <Descriptions.Item label="tags" span={4}>
                        <Space direction="horizontal">
                          {model.tags.map(t => <Tag key={t}>{t}</Tag>)}
                        </Space>
                      </Descriptions.Item>
                      :
                      <Descriptions.Item span={4}></Descriptions.Item>
                    }
                  </Descriptions>
                </Descriptions.Item>
                : null
              }
              {model.url ?
                <Descriptions.Item label="url">
                  <Link to={getBaseURL(model.url)} target="_blank" rel="noopener noreferrer">{model.url}</Link>
                </Descriptions.Item>
                : null
              }
              {model.batchEndpoint ?
                <Descriptions.Item label="batch endpoint">
                  <Link to={getBaseURL(model.batchEndpoint)} target="_blank" rel="noopener noreferrer">{model.batchEndpoint}</Link>
                </Descriptions.Item>
                : null
              }
            </Descriptions>
          </Card>
        </Content>
        <Sider
          theme="light"
          width={350}
          style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}
        >
          <div style={{ margin: '24px 8px 16px' }}>
            {loaded && Object.keys(model.arguments?.properties || {}).length ?
              <>
                <div style={{ color: 'rgba(0, 0, 0, 0.45)', paddingBottom: 16 }}>input schema:</div>
                <Table
                  columns={columns}
                  dataSource={data}
                  pagination={false}
                />
              </>
              :
              <div>Input schema not defined</div>
            }
          </div>
          <div style={{ margin: '24px 8px 16px' }}>
            {loaded && Object.keys(model.returnTypeSchema?.properties || {}).length ?
              <>
                <div style={{ color: 'rgba(0, 0, 0, 0.45)', paddingBottom: 16 }}>output schema:</div>
                <Table
                  columns={columns}
                  dataSource={outputData}
                  pagination={false}
                />
              </>
              :
              <div>Output schema not defined</div>
            }
          </div>
        </Sider>
      </Layout>
    </div >
  );

}