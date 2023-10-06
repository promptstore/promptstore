import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Layout, Select, Table } from 'antd';
import { LinkOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import isEmpty from 'lodash.isempty';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import { v4 as uuidv4 } from 'uuid';

import { Chat } from '../../components/Chat';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  createPromptSetAsync,
  getPromptSetsAsync,
  selectLoading as selectPromptSetsLoading,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';

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
  selectTraceId,
  setTraceId,
} from './chatSlice';

const { Content, Sider } = Layout;
const { TextArea } = Input;

const uiSchema = {
  'ui:title': 'Additional expected inputs',
  'ui:submitButtonOptions': {
    'norender': true,
  },
};

export function Designer() {

  const [createdUuid, setCreatedUuid] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [modelParams, setModelParams] = useState({});
  const [argsFormData, setArgsFormData] = useState(null);
  const [sessionsCollapsed, setSessionsCollapsed] = useState(true);
  const [promptsCollapsed, setPromptsCollapsed] = useState(true);

  const chatLoading = useSelector(selectChatLoading);
  const chatSessions = useSelector(selectChatSessions);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const messages = useSelector(selectMessages);
  const promptSets = useSelector(selectPromptSets);
  const promptSetsLoading = useSelector(selectPromptSetsLoading);
  const traceId = useSelector(selectTraceId);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  let id;
  const match = location.pathname.match(/\/design\/(.*)/);
  if (match) {
    id = +match[1];
  }

  const [promptForm] = Form.useForm();
  const promptSetValue = Form.useWatch('promptSet', promptForm);

  const [contentVar, varsSchema] = useMemo(() => {
    if (promptSetValue) {
      const promptSet = promptSets[promptSetValue];
      if (promptSet && promptSet.arguments) {
        const schema = promptSet.arguments;
        if (schema.type === 'object') {
          const props = { ...schema.properties };
          let contentVar;
          if ('content' in props) {
            contentVar = 'content';
          } else if ('text' in props) {
            contentVar = 'text';
          } else if ('input' in props) {
            contentVar = 'input';
          }
          if (contentVar) {
            const keys = Object.keys(props);
            if (keys.length > 1) {
              delete props['content'];
              const required = [...(schema.required || [])];
              const index = required.indexOf('content');
              if (index > -1) {
                required.splice(index, 1);
              }
              return [contentVar, {
                ...schema,
                properties: props,
                required,
              }];
            } else {
              return [contentVar, null];
            }
          } else {
            return [null, schema];
          }
        }
      }
    }
    return [null, null];
  }, [promptSetValue]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      title: 'Prompt Design',
    }));
    if (id) {
      setPromptsCollapsed(false);
    }
    return () => {
      onReset();
    };
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getPromptSetsAsync({ workspaceId }));
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

  const promptSetOptions = useMemo(() => {
    if (promptSets) {
      return Object.values(promptSets).map((s) => ({
        key: s.id,
        label: s.name,
        value: s.id,
      }));
    }
    return [];
  }, [promptSets]);

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

  const handleChatSubmit = async (values) => {
    let sp;
    let history = [];
    let messages = values.messages;
    const originalMessages = messages;
    let args;
    let engine;
    if (messages.length > 1) {
      history = messages.slice(0, -1);
      messages = messages.slice(-1);
    }
    const { promptSet, systemPrompt } = await promptForm.validateFields();
    if (promptSet) {
      const ps = promptSets[promptSet];
      if (ps && ps.prompts) {
        engine = ps.templateEngine || 'es6';
        sp = ps.prompts
          .filter(p => p.role === 'system')
          .map(p => p.prompt)
          .join('\n\n')
          ;
        if (contentVar || varsSchema) {
          const nonSystemMessages = ps.prompts
            .filter(p => p.role !== 'system')
            .map(p => ({ role: p.role, content: p.prompt }))
            ;
          if (contentVar) {
            const content = messages[0].content;
            args = { [contentVar]: content };
            if (nonSystemMessages.length > 1) {
              history = [
                ...nonSystemMessages.slice(0, -1),
                ...history,
              ];
            }
            messages = nonSystemMessages.slice(-1);
          }
          if (varsSchema) {
            args = { ...args, ...argsFormData };
            if (!contentVar) {
              if (nonSystemMessages.length > 0) {
                history = [
                  ...nonSystemMessages,
                  ...history,
                ];
              }
            }
          }
        } else {
          history = [
            ...ps.prompts.filter(p => p.role !== 'system').map(p => ({ role: p.role, content: p.prompt })),
            ...history,
          ];
        }
      }
    } else if (systemPrompt) {
      sp = systemPrompt;
    }
    dispatch(getChatResponseAsync({
      systemPrompt: sp,
      history,
      messages,
      originalMessages,
      args,
      engine,
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

  const clearPromptFields = () => {
    promptForm.resetFields();
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
          <Sider
            collapsible
            collapsed={promptsCollapsed}
            collapsedWidth={0}
            trigger={null}
            style={{ height: '100%', marginRight: 20 }}
            width={250}
            theme="light"
          >
            <Form
              autoComplete="off"
              form={promptForm}
              layout="vertical"
              name="prompts-form"
              initialValues={{ promptSet: id }}
              style={{ padding: '24px 8px' }}
            >
              <div style={{ display: 'flex' }}>
                <Form.Item
                  label="Prompt Template"
                  name="promptSet"
                  style={{ marginBottom: 16, width: promptSetValue ? 202 : 234 }}
                >
                  <Select allowClear
                    loading={promptSetsLoading}
                    options={promptSetOptions}
                    optionFilterProp="label"
                  />
                </Form.Item>
                {promptSetValue ?
                  <Button
                    type="link"
                    icon={<LinkOutlined />}
                    onClick={() => navigate(`/prompt-sets/${promptSetValue}`)}
                    style={{ marginTop: 32, width: 32 }}
                  />
                  : null
                }
              </div>
              <div style={{ color: '#1677ff', marginBottom: 24 }}>
                <Link to="/prompt-sets">Browse templates...</Link>
              </div>
              <Form.Item
                label="System prompt"
                name="systemPrompt"
                extra="Instead of template"
              >
                <TextArea
                  autoSize={{ minRows: 4, maxRows: 14 }}
                  disabled={!!promptSetValue}
                />
              </Form.Item>
              <Button onClick={clearPromptFields} type="default" size="small">
                Reset
              </Button>
            </Form>
          </Sider>
          <Content>
            <div style={{ marginLeft: -8 }}>
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
            <div style={{ marginBottom: 10, marginLeft: -8 }}>
              <Button
                type="text"
                icon={promptsCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setPromptsCollapsed(!promptsCollapsed)}
                style={{
                  fontSize: '14px',
                  width: 32,
                  height: 32,
                }}
              />
              <span>Prompts</span>
            </div>
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
              traceId={traceId}
            />
            {varsSchema ?
              <div style={{ marginTop: 24, width: 868 }}>
                <div style={{ float: 'right' }}>
                  <Button type="default" size="small"
                    disabled={isEmpty(argsFormData)}
                    onClick={() => { setArgsFormData(null); }}
                  >
                    Reset vars
                  </Button>
                </div>
                <div style={{ width: '50%' }}>
                  <SchemaForm
                    schema={varsSchema}
                    uiSchema={uiSchema}
                    validator={validator}
                    formData={argsFormData}
                    onChange={(e) => setArgsFormData(e.formData)}
                    submitter={false}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  The message will be assigned to the `content` variable if using a Prompt Template.
                </div>
              </div>
              : null
            }
          </Content>
          <Sider
            style={{ backgroundColor: 'inherit', marginLeft: 20 }}
            width={250}
          >
            <ModelParamsForm
              includes={{
                maxTokens: true,
                temperature: true,
                topP: true,
                stopSequences: true,
                frequencyPenalty: true,
                presencePenalty: true,
                topK: true,
              }}
              onChange={setModelParams}
            />
          </Sider>
        </Layout>
      </div>
    </>
  );
}