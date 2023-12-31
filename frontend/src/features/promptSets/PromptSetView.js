import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { Button, Card, Descriptions, Divider, Layout, Space, Table, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import * as dayjs from 'dayjs';
import snakeCase from 'lodash.snakecase';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';

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

  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const promptSets = useSelector(selectPromptSets);

  const { setNavbarState } = useContext(NavbarContext);

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

  const data = useMemo(() => {
    if (ps && ps.arguments) {
      const list = Object.entries(ps.arguments.properties).map(([k, v]) => {
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
  }, [ps]);

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
    <div style={{ marginTop: 20 }}>
      <Layout>
        <Sider
          style={{ border: '1px solid #f0f0f0', marginRight: 16 }}
          width={250}
          theme="light"
        >
          <Table
            columns={versionColumns}
            dataSource={versions}
            loading={loading}
            pagination={false}
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
          <Card title={ps.name}
            extra={
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <Link to={`/prompt-sets`}>List</Link>
                <Link to={`/prompt-sets/${id}/edit`}>Edit</Link>
                <Link to={`/design/${id}`}>Design</Link>
                <Download filename={snakeCase(ps.name) + '.json'} payload={ps}>
                  <Button type="text" icon={<DownloadOutlined />} />
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
          theme="light"
          width={350}
          style={{ border: '1px solid #f0f0f0' }}
        >
          <div style={{ margin: '24px 8px 16px' }}>
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
          </div>
        </Sider>
      </Layout>
    </div>
  );

}