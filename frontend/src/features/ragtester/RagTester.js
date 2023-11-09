import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Button, Descriptions, Layout, Select, Space, Table, Tag } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { Chat } from '../../components/Chat';
import { createPromptSetAsync } from '../promptSets/promptSetsSlice';

import { CreatePromptSetModalForm } from '../designer/CreatePromptSetModalForm';
import { ModelParamsForm } from '../designer/ModelParamsForm';
import {
  createChatSessionAsync,
  deleteChatSessionsAsync,
  getChatSessionsAsync,
  resetChatSessions,
  selectChatSessions,
  selectLoaded,
  selectLoading,
  updateChatSessionAsync,
} from '../designer/chatSessionsSlice';
import {
  getFunctionResponseAsync as getChatResponseAsync,
  selectLoading as selectChatLoading,
  selectMessages,
  setMessages,
} from '../designer/chatSlice';
import {
  getDataSourcesAsync,
  selectDataSources,
} from '../dataSources/dataSourcesSlice';
import {
  getFunctionsAsync,
  getFunctionsByTagAsync,
  selectFunctions,
} from '../functions/functionsSlice';
import {
  getIndexesAsync,
  selectIndexes,
} from '../indexes/indexesSlice';
import {
  getModelsAsync,
  selectModels,
} from '../models/modelsSlice';
import {
  getSettingAsync,
  selectLoading as selectSettingsLoading,
  selectSettings,
} from '../promptSets/settingsSlice';
import { intersects } from '../../utils';

const { Content, Sider } = Layout;

const TAGS_KEY = 'functionTags';

const hasIndex = (f) => !!f.implementations?.find(m => m.indexes?.length || m.sqlSourceId || m.graphSourceId);

export function RagTester() {

  const [createdUuid, setCreatedUuid] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [selectedImplementation, setSelectedImplementation] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionsCollapsed, setSessionsCollapsed] = useState(true);
  const [copyParams, setCopyParams] = useState({});
  const [selectedTags, setSelectedTags] = useLocalStorageState('selected-rag-tags', { defaultValue: [] });

  const chatLoading = useSelector(selectChatLoading);
  const messages = useSelector(selectMessages);
  const chatSessions = useSelector(selectChatSessions);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const dataSources = useSelector(selectDataSources);
  const functions = useSelector(selectFunctions);
  const indexes = useSelector(selectIndexes);
  const models = useSelector(selectModels);
  const settings = useSelector(selectSettings);
  const settingsLoading = useSelector(selectSettingsLoading);

  const func = functions[selectedFunction];
  const impl = func?.implementations.find((impl) => impl.modelId === selectedImplementation);
  const idxs = (impl?.indexes || []).map((idx) => indexes[idx.indexId]);
  const featureStoreSource = dataSources[impl?.dataSourceId];
  const sqlSource = dataSources[impl?.sqlSourceId];

  // console.log('func:', func);
  // console.log('impl:', impl);
  // console.log('indexes:', indexes);
  // console.log('featureStoreSource:', featureStoreSource);
  // console.log('sqlSource:', sqlSource);
  // console.log('messages:', messages);
  // console.log('idxs:', idxs);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      title: 'RAG Tester',
    }));
    return () => {
      onReset();
    };
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getDataSourcesAsync({ workspaceId }));
      dispatch(getIndexesAsync({ workspaceId }));
      dispatch(getModelsAsync({ workspaceId }));
      // dispatch(getFunctionsByTagAsync({ tag: 'rag', workspaceId }));
      dispatch(getFunctionsAsync({ workspaceId }));
      dispatch(getChatSessionsAsync({ workspaceId, type: 'rag' }));
      dispatch(getSettingAsync({ workspaceId: selectedWorkspace.id, key: TAGS_KEY }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (createdUuid && chatSessions) {
      const session = Object.values(chatSessions).find(s => s.uuid === createdUuid);
      if (session) {
        setSelectedSession(session);
        setCreatedUuid(null);
      }
    }
  }, [chatSessions, createdUuid]);

  const columns = [
    {
      title: 'Sessions',
      dataIndex: 'name',
      width: '100%',
      render: (_, { key, name }) => (
        <Link onClick={() => openSession(key)}>{name}</Link>
      )
    },
  ];

  const data = useMemo(() => {
    const list = Object.values(chatSessions).map((sess) => ({
      key: sess.id,
      name: sess.name || sess.id,
    }));
    // list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [chatSessions]);

  const functionOptions = useMemo(() => {
    const tags = selectedTags || [];
    const list = Object.values(functions)
      .filter((f) => hasIndex(f) && (!tags.length || intersects(tags, f.tags)))
      .map((f) => ({
        value: f.id,
        label: f.name,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [functions, selectedTags]);

  const implementationOptions = useMemo(() => {
    if (!func) {
      return [];
    }
    const list = Object.values(func.implementations).map((impl) => ({
      value: impl.modelId,
      label: models[impl.modelId].name,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [func]);

  const tagOptions = useMemo(() => {
    const setting = Object.values(settings).find(s => s.key === TAGS_KEY);
    if (setting) {
      const list = [...setting.value];
      list.sort();
      return list.map(s => ({
        label: s,
        value: s,
      }));
    }
    return [];
  }, [settings]);

  const openSession = (id) => {
    const session = chatSessions[id];
    // console.log('session:', session);
    setSelectedFunction(session.functionId);
    setSelectedImplementation(session.modelId);
    dispatch(setMessages(session));
    setSelectedSession(session);
  };

  const handleChatSubmit = (values) => {
    // console.log('values:', values);
    const { messages } = values;
    const content = messages[messages.length - 1].content;
    const model = models[impl.modelId];
    // console.log('model:', model);
    dispatch(getChatResponseAsync({
      functionName: func.name,
      args: { content },
      history: messages.slice(0, messages.length - 1),
      params: { model: model.key },
      workspaceId: selectedWorkspace.id,
    }));
  };

  const handleCreateCancel = () => {
    setIsCreateModalOpen(false);
  };

  const onUseSelected = () => {
    setIsCreateModalOpen(true);
  };

  const onReset = () => {
    dispatch(setMessages({ messages: [] }));
    dispatch(resetChatSessions());
  };

  const onSave = () => {
    if (selectedSession) {
      dispatch(updateChatSessionAsync({
        id: selectedSession.id,
        values: { ...selectedSession, messages },
      }));
    } else {
      const uuid = uuidv4();
      dispatch(createChatSessionAsync({
        uuid,
        values: {
          messages,
          workspaceId: selectedWorkspace.id,
          type: 'rag',
          functionId: selectedFunction,
          modelId: selectedImplementation,
        },
      }));
      setCreatedUuid(uuid);
    }
  };

  const handleCreate = (values) => {
    // console.log('values:', values);
    if (selectedWorkspace) {
      const msgs = messages.filter((m) => selectedMessages.indexOf(m.key) !== -1);
      const prompts = msgs.map((m) => ({
        prompt: m.content,
        role: m.role,
      }));
      values = {
        ...values,
        workspaceId: selectedWorkspace.id,
        prompts,
      };
      dispatch(createPromptSetAsync({ values }));
    }
    onSave();
    setIsCreateModalOpen(false);
    navigate('/prompt-sets');
  };

  const onDelete = () => {
    dispatch(deleteChatSessionsAsync({ ids: selectedRowKeys }));
    if (selectedSession && selectedRowKeys.includes(selectedSession.id)) {
      onReset();
      setSelectedSession(null);
    }
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [
      Table.SELECTION_ALL,
    ],
  };

  const hasSelected = selectedRowKeys.length > 0;

  return (
    <>
      <CreatePromptSetModalForm
        open={isCreateModalOpen}
        onCancel={handleCreateCancel}
        onOk={handleCreate}
      />
      <div style={{ height: '100%', marginTop: 20 }}>
        <Layout style={{ height: '100%' }}>
          <Sider
            collapsible
            collapsed={sessionsCollapsed}
            collapsedWidth={0}
            trigger={null}
            style={{ height: '100%', marginRight: 20 }}
            width={250}
            theme="light"
          >
            <div style={{ margin: '24px 8px 16px' }}>
              <Button danger type="primary" size="small" onClick={onDelete} disabled={!hasSelected}>
                Delete
              </Button>
              <span style={{ marginLeft: 8 }}>
                {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
              </span>
            </div>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={data}
              loading={loading}
            />
          </Sider>
          <Content>
            <div style={{ marginBottom: 10, marginLeft: -8 }}>
              <Button
                type="text"
                icon={sessionsCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setSessionsCollapsed(!sessionsCollapsed)}
                style={{
                  fontSize: '14px',
                  width: 32,
                  height: 32,
                }}
              />
              <span>Sessions</span>
            </div>
            <div style={{ marginBottom: 20 }}>
              <Space direction="vertical">
                <Space>
                  <Select allowClear mode="multiple"
                    options={tagOptions}
                    optionFilterProp="label"
                    loading={settingsLoading}
                    placeholder="select tags"
                    onChange={setSelectedTags}
                    style={{ width: 220 }}
                    value={selectedTags}
                  />
                  <Select allowClear
                    options={functionOptions}
                    optionFilterProp="label"
                    onChange={setSelectedFunction}
                    value={selectedFunction}
                    placeholder="Select Semantic Function"
                    style={{ width: 250 }}
                  />
                  {func ?
                    <Select allowClear
                      options={implementationOptions}
                      optionFilterProp="label"
                      onChange={setSelectedImplementation}
                      value={selectedImplementation}
                      placeholder="Select Implementation"
                      style={{ width: 250 }}
                    />
                    : null
                  }
                </Space>
                {impl ?
                  <Descriptions column={1} layout="vertical">
                    {featureStoreSource ?
                      <Descriptions.Item label="Feature Store Source">
                        <Space>
                          <Tag>{featureStoreSource.featurestore}</Tag>
                          <span>{featureStoreSource.name}</span>
                        </Space>
                      </Descriptions.Item>
                      : null
                    }
                    {sqlSource ?
                      <Descriptions.Item label="SQL Source">
                        <Space>
                          <Tag>{sqlSource.dialect}</Tag>
                          <span>{sqlSource.name}</span>
                        </Space>
                      </Descriptions.Item>
                      : null
                    }
                    <Descriptions.Item label="Semantic Indexes">
                      <Space direction="vertical">
                        {idxs.map((idx) => (
                          <Space key={'idx-' + idx.id}>
                            <Tag>{idx.vectorStoreProvider}</Tag>
                            <span>{idx.name}</span>
                          </Space>
                        ))}
                      </Space>
                    </Descriptions.Item>
                  </Descriptions>
                  : null
                }
              </Space>
            </div>
            <Chat
              disabled={!impl}
              enableActions={true}
              loading={chatLoading}
              messages={messages}
              onSelected={setSelectedMessages}
              onSubmit={handleChatSubmit}
              onUseSelected={onUseSelected}
              onReset={onReset}
              onSave={onSave}
              placeholder="Enter a query"
            />
          </Content>
          <Sider
            style={{ backgroundColor: 'inherit', marginLeft: 20 }}
            width={250}
          >
            <ModelParamsForm
              includes={{ maxTokens: true, temperature: true, topP: true }}
              onChange={setCopyParams}
            />
          </Sider>
        </Layout>
      </div>
    </>
  );
}