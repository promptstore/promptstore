import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Layout, Table } from 'antd';
import { v4 as uuidv4 } from 'uuid';

import { Chat } from '../../components/Chat';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { createPromptSetAsync } from '../promptSets/promptSetsSlice';

import { ModelParamsForm } from './ModelParamsForm';
import { CreatePromptSetModalForm } from './CreatePromptSetModalForm';
import {
  createChatSessionAsync,
  deleteChatSessionsAsync,
  getChatSessionsAsync,
  resetChatSessions,
  selectChatSessions,
  selectLoaded,
  selectLoading,
  updateChatSessionAsync,
} from './chatSessionsSlice';
import {
  getResponseAsync as getChatResponseAsync,
  selectLoading as selectChatLoading,
  selectMessages,
  setMessages,
} from './chatSlice';

const { Content, Sider } = Layout;

export function Designer() {

  const [createdUuid, setCreatedUuid] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [modelParams, setModelParams] = useState({});

  const chatLoading = useSelector(selectChatLoading);
  const chatSessions = useSelector(selectChatSessions);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const messages = useSelector(selectMessages);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      title: 'Prompt Designer',
    }));
    return () => {
      onReset();
    };
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getChatSessionsAsync({ workspaceId, type: 'design' }));
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

  const openSession = (id) => {
    const session = chatSessions[id];
    dispatch(setMessages({ messages: session.messages }));
    console.log('session:', session)
    setSelectedSession(session);
  };

  const handleChatSubmit = (values) => {
    dispatch(getChatResponseAsync({
      messages: values.messages,
      modelParams,
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
    setSelectedSession(null);
    // dispatch(resetChatSessions());
  };

  const onSave = () => {
    if (selectedSession) {
      dispatch(updateChatSessionAsync({
        id: selectedSession.id,
        values: { messages },
      }));
    } else {
      const uuid = uuidv4();
      dispatch(createChatSessionAsync({
        uuid,
        values: {
          messages,
          workspaceId: selectedWorkspace.id,
          type: 'design',
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
            <Chat
              enableActions={true}
              loading={chatLoading}
              messages={messages}
              onSelected={setSelectedMessages}
              onSubmit={handleChatSubmit}
              selectable={true}
              selectMultiple={true}
              onUseSelected={onUseSelected}
              onReset={onReset}
              onSave={onSave}
              placeholder="Write an email subject line for the latest iPhone."
            />
          </Content>
          <Sider
            style={{ backgroundColor: 'inherit', marginLeft: 20 }}
            width={250}
          >
            <ModelParamsForm
              includes={{ maxTokens: true, temperature: true, topP: true }}
              onChange={setModelParams}
            />
          </Sider>
        </Layout>
      </div>
    </>
  );
}