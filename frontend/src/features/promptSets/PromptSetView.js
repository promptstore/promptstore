import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Layout,
  List,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { DownloadOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import * as dayjs from 'dayjs';
import snakeCase from 'lodash.snakecase';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import useLocalStorageState from 'use-local-storage-state';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  getFunctionsByPromptSetAsync,
  selectFunctions,
} from '../functions/functionsSlice';

import {
  getPromptSetAsync,
  selectLoaded,
  selectLoading,
  selectPromptSets,
} from './promptSetsSlice';

const { Content, Sider } = Layout;

const TIME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

export function PromptSetView() {

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [versionsCollapsed, setVersionsCollapsed] = useLocalStorageState('ps-versions-collapsed', { defaultValue: true });
  const [variablesCollapsed, setVariablesCollapsed] = useLocalStorageState('ps-variables-collapsed', { defaultValue: true });

  const functions = useSelector(selectFunctions);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const promptSets = useSelector(selectPromptSets);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();

  const id = location.pathname.match(/\/prompt-sets\/(.*)/)[1];
  const ps = promptSets[id];

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Prompt Template',
    }));
    dispatch(getPromptSetAsync(id));
  }, []);

  useEffect(() => {
    if (ps) {
      dispatch(getFunctionsByPromptSetAsync({
        workspaceId: selectedWorkspace.id,
        promptSetId: ps.id,
      }));
    }
  }, [ps]);

  const versionColumns = [
    {
      title: 'Versions',
      dataIndex: 'title',
      width: '100%',
      render: (_, { key, created, title }) => (
        <div>
          <div>
            {title}
          </div>
          <div
            className="text-secondary"
            style={{ marginTop: 5 }}
          >
            {dayjs(created).format(TIME_FORMAT)}
          </div>
        </div>
      )
    },
  ];

  const versions = useMemo(() => {
    if (!ps?.versions) return [];
    const vs = ps.versions.map(s => ({
      key: s.id,
      title: s.title,
      created: s.created,
      username: s.username,
    }));
    vs.sort((a, b) => a.created < b.created ? 1 : -1);
    return vs;
  }, [ps]);

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

  const getVars = (properties) => {
    const list = Object.entries(properties).map(([k, v]) => {
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
  };

  const data = useMemo(() => {
    if (ps && ps.arguments) {
      // TODO show array
      if (ps.arguments.type === 'array') {
        return getVars(ps.arguments.items.properties);
      }
      return getVars(ps.arguments.properties);
    }
    return [];
  }, [ps]);

  const functionsList = useMemo(() => {
    return Object.values(functions).map(f => ({
      id: f.id,
      name: f.name,
    }));
  }, [functions]);

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    type: 'radio',
  };

  const getPrompt = useCallback((p) => {
    let prompt = p.prompt
      .replace(/([\[\]\*])/g, '\\$1')
      .replace(/({{(#if|#ifmultiple|#each)\s+(.*?)\s*}})/g, '<div class="promptindent"><code class="promptcontrol">$1</code>')
      .replace(/({{\/(if|ifmultiple|each)\s*}})/g, '<code class="promptcontrol">$1</code></div>')
      .replace(/({{\s*else\s*}})/g, '<code class="promptcontrol">$1</code>');

    if (selectedRowKeys.length) {
      prompt = prompt
        .replace(new RegExp(`({{(list\\s+|\\s+)?${selectedRowKeys[0]}\\s*}})`, 'g'), '<code class="highlightedvar">$1</code>')
        .replace(new RegExp(`({{(?!(list\\s+|\\s+)?(else|${selectedRowKeys[0]}|[#\\/])).*?}})`, 'g'), '<code>$1</code>')
        .replace(new RegExp(`(\\\${${selectedRowKeys[0]}})`, 'g'), '<code class="highlightedvar">$1</code>')
        .replace(new RegExp(`(\\\${(?!${selectedRowKeys[0]}).*?})`, 'g'), '<code>$1</code>');
    } else {
      prompt = prompt
        .replace(/({{(?!\s*(else|[#\/])).*?}})/g, '<code>$1</code>')
        .replace(/(\${.*?})/g, '<code>$1</code>');
    }
    return prompt;
  }, [selectedRowKeys]);

  // console.log('prompt set:', ps);

  if (!ps) {
    return (
      <div style={{ marginTop: 20 }}>
        Loading...
      </div>
    );
  }
  return (
    <div id="promptset-view" style={{ marginTop: 20 }}>
      <Layout>
        <Sider
          collapsible
          collapsed={versionsCollapsed}
          collapsedWidth={0}
          trigger={null}
          style={{
            borderRadius: '8px 8px 0 0',
            border: versionsCollapsed ? '1px solid #f5f5f5' : '1px solid #f0f0f0',
            marginRight: 16,
          }}
          theme="light"
          width={250}
        >
          <Table
            columns={versionColumns}
            dataSource={versions}
            loading={loading}
            pagination={false}
          />
          <List
            header={<div>Semantic Functions</div>}
            dataSource={functionsList}
            renderItem={(item) => (
              <List.Item>
                <Link to={`/functions/${item.id}`}>{item.name}</Link>
              </List.Item>
            )}
          />
          {ps && ps.tags ?
            <div style={{ padding: '24px 8px 16px' }}>
              <div style={{ marginBottom: 8 }}>Tags:</div>
              <Space direction="horizontal">
                {ps.tags.map(t => <Tag key={t}>{t}</Tag>)}
              </Space>
            </div>
            : null
          }
        </Sider>
        <Content>
          <div>
            <Button
              type="text"
              icon={versionsCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setVersionsCollapsed(cur => !cur)}
              style={{
                fontSize: '14px',
                width: 32,
                height: 32,
              }}
            />
            <span>Versions</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <Button
              type="text"
              icon={variablesCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setVariablesCollapsed(cur => !cur)}
              style={{
                fontSize: '14px',
                width: 32,
                height: 32,
              }}
            />
            <span>Variables</span>
          </div>
          <Card className="ps-view-card" title={ps.name}
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Link to={`/prompt-sets`}>List</Link>
                <Link to={`/prompt-sets/${id}/edit`}>Edit</Link>
                <Link to={`/design/${id}`}>Design</Link>
                <Download filename={snakeCase(ps.name) + '.json'} payload={ps}>
                  <Button type="text" icon={<DownloadOutlined />}>
                    Download
                  </Button>
                </Download>
              </div>
            }
            loading={loading}
            style={{ minWidth: 594, width: '65%' }}
          >
            <Descriptions column={1} layout="vertical">
              <Descriptions.Item label="description">
                <Typography.Text className="prompttext">
                  <p>{ps.description}</p>
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item>
                <Divider orientation="left">TEMPLATE</Divider>
              </Descriptions.Item>
              {ps.prompts?.map((p, i) =>
                <Descriptions.Item key={'p' + i} label={p.role}>
                  <Typography.Text className="prompttext">
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                      {getPrompt(p)}
                    </ReactMarkdown>
                  </Typography.Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Content>
        <Sider
          collapsible
          collapsed={variablesCollapsed}
          collapsedWidth={0}
          trigger={null}
          style={{
            borderRadius: '8px 8px 0 0',
            border: variablesCollapsed ? '1px solid #f5f5f5' : '1px solid #f0f0f0',
          }}
          theme="light"
          width={350}
        >
          {loaded && ps.arguments ?
            <Table
              columns={columns}
              dataSource={data}
              pagination={false}
              rowSelection={rowSelection}
            />
            :
            <div>Schema not defined</div>
          }
        </Sider>
      </Layout>
    </div>
  );

}