import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Button, Layout, Table } from 'antd';

import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import { Chat } from '../../components/Chat';
import { createPromptSetAsync } from '../promptSets/promptSetsSlice';

import { CreatePromptSetModalForm } from './CreatePromptSetModalForm';
import { CopyParamsForm } from './CopyParamsForm';
import {
  createChatSessionAsync,
  deleteChatSessionsAsync,
  getChatSessionsAsync,
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

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [copyParams, setCopyParams] = useState({});

  const chatLoading = useSelector(selectChatLoading);
  const messages = useSelector(selectMessages);
  const chatSessions = useSelector(selectChatSessions);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      title: 'Prompt Designer',
    }));
    dispatch(getChatSessionsAsync());
  }, []);

  const columns = [
    {
      title: 'Session',
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
    setSelectedSession(session);
  };

  const handleChatSubmit = (values) => {
    dispatch(getChatResponseAsync({ ...values, ...copyParams }));
  };

  const handleCreateCancel = () => {
    setIsCreateModalOpen(false);
  };

  const onUseSelected = () => {
    setIsCreateModalOpen(true);
  };

  const onReset = () => {
    dispatch(setMessages({ messages: [] }));
  };

  const onSave = () => {
    if (selectedSession) {
      dispatch(updateChatSessionAsync({
        id: selectedSession.id,
        values: {
          messages,
        },
      }));
    } else {
      dispatch(createChatSessionAsync({
        values: {
          messages,
        },
      }));
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
    if (selectedSession && selectedRowKeys.indexOf(selectedSession.id) !== -1) {
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
            <CopyParamsForm
              includes={{ maxTokens: true, temperature: true, topP: true }}
              onChange={setCopyParams}
            />
          </Sider>
        </Layout>
      </div>
    </>
  );
}