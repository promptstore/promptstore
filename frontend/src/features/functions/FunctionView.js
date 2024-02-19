import { useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Descriptions, Layout, Space, Tag, Table, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import snakeCase from 'lodash.snakecase';
import ReactFlow, { ReactFlowProvider } from 'reactflow';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getDataSourcesAsync,
  selectDataSources,
  selectLoaded as selectDataSourcesLoaded,
} from '../dataSources/dataSourcesSlice';
import {
  getIndexesAsync,
  selectIndexes,
  selectLoaded as selectIndexesLoaded,
} from '../indexes/indexesSlice';
import {
  getModelsAsync,
  selectLoaded as selectModelsLoaded,
  selectModels,
} from '../models/modelsSlice';
import {
  getPromptSetsAsync,
  selectLoaded as selectPromptSetsLoaded,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';

import {
  getFunctionAsync,
  selectLoaded,
  selectLoading,
  selectFunctions,
} from './functionsSlice';

import 'reactflow/dist/style.css';

const { Content, Sider } = Layout;

const nodeProps = { style: { width: 200 } };

const proOptions = { hideAttribution: true };

const reactFlowProps = {
  panOnDrag: false,
  panOnScroll: false,
  zoomOnScroll: false,
  zoomOnPinch: false,
  zoomOnDoubleClick: false,
  nodesDraggable: false,
  nodesConnectable: false,
};

export function FunctionView() {

  const functions = useSelector(selectFunctions);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const promptSets = useSelector(selectPromptSets);
  const promptsSetsLoaded = useSelector(selectPromptSetsLoaded);
  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);
  const dataSources = useSelector(selectDataSources);
  const dataSourcesLoaded = useSelector(selectDataSourcesLoaded);
  const indexes = useSelector(selectIndexes);
  const indexesLoaded = useSelector(selectIndexesLoaded);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const id = location.pathname.match(/\/functions\/(.*)/)[1];
  const func = functions[id];

  const graphs = useMemo(() => {
    const graphs = [];
    if (func && promptsSetsLoaded && modelsLoaded && dataSourcesLoaded && indexesLoaded) {
      let x = 0;
      let y = 0;
      let i = 1;
      for (const impl of func.implementations) {
        const nds = [];
        const eds = [];
        const sources = [];
        if (impl.dataSourceId) {
          const ds = dataSources[impl.dataSourceId];
          const id = 'fs' + i;
          nds.push({
            id,
            data: {
              label: (
                <div>
                  <span style={{ color: 'rgba(0, 0, 0, 0.45)' }}>feature store:</span> {ds.name}
                </div>
              ),
              type: 'data-sources',
              id: impl.dataSourceId,
            },
            position: { x: 0, y },
            type: 'input',
            ...nodeProps,
          });
          sources.push(id);
        }
        if (impl.sqlSourceId) {
          if (sources.length) {
            x += 220;
          }
          const ds = dataSources[impl.sqlSourceId];
          const id = 'ss' + i;
          nds.push({
            id,
            data: {
              label: (
                <div className="funcstep">
                  <div>sql store:</div>
                  <div>{ds.name}</div>
                </div>
              ),
              type: 'data-sources',
              id: impl.sqlSourceId,
            },
            position: { x: 0, y },
            type: 'input',
            ...nodeProps,
          });
          sources.push(id);
        }
        if (impl.graphSourceId) {
          if (sources.length) {
            x += 220;
          }
          const ds = dataSources[impl.graphSourceId];
          const id = 'gs' + i;
          nds.push({
            id,
            data: {
              label: (
                <div className="funcstep">
                  <div>graph store:</div>
                  <div>{ds.name}</div>
                </div>
              ),
              type: 'data-sources',
              id: impl.graphSourceId,
            },
            position: { x, y },
            type: 'input',
            ...nodeProps,
          });
          sources.push(id);
        }
        if (impl.indexes) {
          if (sources.length) {
            x += 220;
          }
          let j = 1;
          for (const { indexId } of impl.indexes) {
            const ix = indexes[indexId];
            if (ix) {
              const id = `ix${i}-${j}`;
              nds.push({
                id,
                data: {
                  label: (
                    <div className="funcstep">
                      <div>semantic index:</div>
                      <div>{ix.name}</div>
                    </div>
                  ),
                  type: 'indexes',
                  id: indexId,
                },
                position: { x, y },
                type: 'input',
                ...nodeProps,
              });
              sources.push(id);
              x += 220;
              j += 1;
            }
          }
        }
        x = 0;
        if (impl.promptSetId) {
          const ps = promptSets[impl.promptSetId];
          if (ps) {
            if (sources.length) {
              y += 100;
            }
            const id = 'ps' + i;
            nds.push({
              id,
              data: {
                label: (
                  <div className="funcstep">
                    <div>prompt template:</div>
                    <div>{ps.name} [{ps.versions?.[impl.promptSetVersion]?.title || 'latest'}]</div>
                  </div>
                ),
                type: 'prompt-sets',
                id: impl.promptSetId,
              },
              position: { x, y },
              type: sources.length ? 'default' : 'input',
              ...nodeProps,
            });
            if (sources.length) {
              for (const source of sources) {
                eds.push({
                  id: `${source}-${id}`,
                  source,
                  target: id,
                });
              }
            }
            sources.length = 0;
            sources.push(id);
          }
        }
        if (impl.inputGuardrails?.length) {
          if (sources.length) {
            y += 100;
          }
          let j = 1;
          const mysources = [...sources];
          sources.length = 0;
          for (const gr of impl.inputGuardrails) {
            const id = `gr${i}-${j}`;
            nds.push({
              id,
              data: {
                label: (
                  <div className="funcstep">
                    <div>input guardrail:</div>
                    <div>{gr}</div>
                  </div>
                ),
              },
              position: { x, y },
              ...nodeProps,
            });
            sources.push(id);
            if (mysources.length) {
              for (const source of mysources) {
                eds.push({
                  id: `${source}-${id}`,
                  source,
                  target: id,
                });
              }
            }
            x += 220;
            j += 1;
          }
          mysources.length = 0;
        }
        x = 0;
        if (impl.cache) {
          if (sources.length) {
            y += 100;
          }
          const id = 'cc' + i;
          nds.push({
            id,
            data: {
              label: 'Semantic Cache',
            },
            position: { x, y },
            ...nodeProps,
          });
          if (sources.length) {
            for (const source of sources) {
              eds.push({
                id: `${source}-${id}`,
                source,
                target: id,
              });
            }
            sources.length = 0;
            sources.push(id)
          }
        }
        if (impl.modelId) {
          if (sources.length) {
            y += 100;
          }
          const model = models[impl.modelId];
          if (model) {
            const id = 'md' + i;
            nds.push({
              id,
              data: {
                label: (
                  <div className="funcstep">
                    <div>model:</div>
                    <div>{model.name}</div>
                  </div>
                ),
                type: 'models',
                id: impl.modelId,
              },
              position: { x, y },
              type: sources.length ? 'default' : 'input',
              ...nodeProps,
            });
            if (sources.length) {
              for (const source of sources) {
                eds.push({
                  id: `${source}-${id}`,
                  source,
                  target: id,
                });
              }
              sources.length = 0;
              sources.push(id)
            }
          }
        }
        if (impl.outputGuardrails?.length) {
          if (sources.length) {
            y += 100;
          }
          let j = 1;
          const mysources = [...sources];
          sources.length = 0;
          for (const gr of impl.outputGuardrails) {
            const id = `og${i}-${j}`;
            nds.push({
              id,
              data: {
                label: (
                  <div className="funcstep">
                    <div>output guardrail:</div>
                    <div>{gr}</div>
                  </div>
                ),
              },
              position: { x, y },
              ...nodeProps,
            });
            sources.push(id);
            if (mysources.length) {
              for (const source of mysources) {
                eds.push({
                  id: `${source}-${id}`,
                  source,
                  target: id,
                });
              }
            }
            x += 220;
            j += 1;
          }
          mysources.length = 0;
        }
        x = 0;
        if (impl.outputParser) {
          if (sources.length) {
            y += 100;
          }
          const id = 'op' + i;
          nds.push({
            id,
            data: {
              label: (
                <div className="funcstep">
                  <div>output parser:</div>
                  <div>{impl.outputParser}</div>
                </div>
              ),
            },
            position: { x, y },
            ...nodeProps,
          });
          if (sources.length) {
            for (const source of sources) {
              eds.push({
                id: `${source}-${id}`,
                source,
                target: id,
              });
            }
            sources.length = 0;
            sources.push(id)
          }
        }
        graphs.push({ nodes: nds, edges: eds });
        i += 1;
        x = 0;
        y = 0;
      }
    }
    return graphs;
  }, [func, promptsSetsLoaded, modelsLoaded, dataSourcesLoaded, indexesLoaded]);

  // console.log('func:', func);
  // console.log('graphs:', graphs);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Semantic Function',
    }));
    dispatch(getFunctionAsync(id));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getPromptSetsAsync({ workspaceId }));
      dispatch(getModelsAsync({ workspaceId }));
      dispatch(getDataSourcesAsync({ workspaceId }));
      dispatch(getIndexesAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

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
    if (func && func.arguments) {
      const list = Object.entries(func.arguments.properties || {}).map(([k, v]) => {
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
  }, [func]);

  const outputData = useMemo(() => {
    if (func && func.returnTypeSchema) {
      const list = Object.entries(func.returnTypeSchema.properties || {}).map(([k, v]) => {
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
  }, [func]);

  const handleNodeClick = (ev, node) => {
    const { type, id } = node.data;
    if (type) {
      navigate(`/${type}/${id}`);
    }
  }

  // console.log('function:', func);

  if (!func) {
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
          <Card title={func.name}
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Link to={`/functions`}>List</Link>
                <Link to={`/functions/${id}/edit`}>Edit</Link>
                <Download filename={snakeCase(func.name) + '.json'} payload={func}>
                  <Button type="text" icon={<DownloadOutlined />}>
                    Download
                  </Button>
                </Download>
              </div>
            }
            loading={loading}
            style={{ marginRight: 16, minWidth: 952 }}
          >
            <Descriptions column={1} layout="vertical">
              <Descriptions.Item label="description">
                <Typography.Text className="prompttext">
                  <p>{func.description}</p>
                </Typography.Text>
              </Descriptions.Item>
              {func.isPublic || func.tags?.length ?
                <Descriptions.Item>
                  <Descriptions column={6}>
                    {func.isPublic ?
                      <Descriptions.Item span={1}>
                        <Tag color="#f50">Public</Tag>
                      </Descriptions.Item>
                      : null
                    }
                    {func.tags?.length ?
                      <Descriptions.Item label="tags" span={5}>
                        <Space direction="horizontal">
                          {func.tags.map(t => <Tag key={t}>{t}</Tag>)}
                        </Space>
                      </Descriptions.Item>
                      : null
                    }
                  </Descriptions>
                </Descriptions.Item>
                : null
              }
              <Descriptions.Item label="implementations">
                <Space wrap>
                  {graphs.map((g, i) =>
                    <fieldset key={'g' + i}>
                      <legend>{i + 1}. {models[func.implementations?.[i]?.modelId]?.name}</legend>
                      <div style={{ height: 700, width: 900, padding: 16 }}>
                        <ReactFlowProvider>
                          <ReactFlow
                            {...reactFlowProps}
                            nodes={g.nodes}
                            edges={g.edges}
                            onNodeClick={handleNodeClick}
                            proOptions={proOptions}
                          />
                        </ReactFlowProvider>
                      </div>
                    </fieldset>
                  )}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Content>
        <Sider
          theme="light"
          width={350}
          style={{ border: '1px solid #f0f0f0' }}
        >
          <div style={{ margin: '24px 8px 16px' }}>
            {loaded && Object.keys(func.arguments?.properties || {}).length ?
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
            {loaded && Object.keys(func.returnTypeSchema?.properties || {}).length ?
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