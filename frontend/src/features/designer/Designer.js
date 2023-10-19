import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Divider, Form, Input, Layout, Select, Table } from 'antd';
import { LinkOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import isEmpty from 'lodash.isempty';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import { v4 as uuidv4 } from 'uuid';
import useLocalStorageState from 'use-local-storage-state';

import { Chat } from '../../components/Chat';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  createPromptSetAsync,
  getPromptSetsAsync,
  selectLoading as selectPromptSetsLoading,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';

import { ModelParamsForm, initialValues as initialModelParamsValue } from './ModelParamsForm';
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

const criteriaOptions = [
  {
    label: 'Conciseness',
    value: 'conciseness',
  },
  {
    label: 'Relevance',
    value: 'relevance',
  },
  {
    label: 'Correctness',
    value: 'correctness',
  },
  {
    label: 'Harmfulness',
    value: 'harmfulness',
  },
  {
    label: 'Maliciousness',
    value: 'maliciousness',
  },
  {
    label: 'Helpfulness',
    value: 'helpfulness',
  },
  {
    label: 'Controversiality',
    value: 'controversiality',
  },
  {
    label: 'Misogyny',
    value: 'misogyny',
  },
  {
    label: 'Criminality',
    value: 'criminality',
  },
  {
    label: 'Insensitivity',
    value: 'insensitivity',
  },
];

export function Designer() {

  const [createdUuid, setCreatedUuid] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(null);
  const [usedMessages, setUsedMessages] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [modelParams, setModelParams] = useState({});
  const [initialModelParams, setInitialModelParams] = useState({});
  const [argsFormData, setArgsFormData] = useState(null);
  const [sessionsCollapsed, setSessionsCollapsed] = useLocalStorageState('design-sessions-collapsed', { defaultValue: true });
  const [promptsCollapsed, setPromptsCollapsed] = useLocalStorageState('design-prompts-collapsed', { defaultValue: true });

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
  const critiquePromptSetValue = Form.useWatch('critiquePromptSet', promptForm);
  const critiquePromptValue = Form.useWatch('critiquePrompt', promptForm);
  const enableCritique = critiquePromptSetValue || critiquePromptValue;

  const [contentVar, varsSchema] = useMemo(() => {
    if (promptSetValue) {
      const promptSet = promptSets[promptSetValue];
      if (promptSet && promptSet.arguments) {
        const schema = promptSet.arguments;
        if (schema.type === 'object') {
          const contentVar = getInputProp(schema.properties);
          const newSchema = excludeProps([contentVar], schema.properties);
          return [contentVar, newSchema];
        }
      }
    }
    return [null, null];
  }, [promptSetValue]);

  const [critiqueContentVar, completionVar, criterionVar, critiqueVarsSchema] = useMemo(() => {
    if (critiquePromptSetValue) {
      const promptSet = promptSets[critiquePromptSetValue];
      if (promptSet && promptSet.arguments) {
        const schema = promptSet.arguments;
        if (schema.type === 'object') {
          const contentVar = getInputProp(schema.properties);
          const completionVar = getCompletionProp(schema.properties);
          const criterionVar = getCritterionProp(schema.properties);
          const newSchema = excludeProps([contentVar, completionVar, criterionVar], schema.properties);
          return [contentVar, completionVar, criterionVar, newSchema];
        }
      }
    }
    return [null, null, null, null];
  }, [critiquePromptSetValue]);

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

  useEffect(() => {
    if (!id && loaded) {
      const sessions = Object.values(chatSessions);
      if (sessions.length) {
        const lastSession = sessions.find(s => s.name === 'last session');
        // console.log('lastSession:', lastSession);
        if (lastSession) {
          dispatch(setMessages({ messages: lastSession.messages.map(formatMessage) }));
          setSelectedSession(lastSession);
          setInitialModelParams({
            ...lastSession.modelParams,
            models: lastSession.modelParams?.models?.map(m => m.id),
            criticModels: lastSession.modelParams?.criticModels?.map(m => m.id),
          });
          promptForm.setFieldsValue({
            promptSet: lastSession.promptSetId,
            systemPrompt: lastSession.systemPromptInput,
            critiquePromptSet: lastSession.critiquePromptSetId,
            critiquePrompt: lastSession.critiquePromptInput,
            criterion: lastSession.criterion,
          });
        }
      }
    }
  }, [loaded]);

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
        <Link onClick={() => openSession(key)}
          style={{ color: selectedSession?.id === key ? '#177ddc' : 'inherit' }}
        >{name}</Link>
      )
    },
  ];

  const data = useMemo(() => {
    const list = Object.values(chatSessions).map((sess) => ({
      key: sess.id,
      name: sess.name || sess.id,
      modified: sess.modified,
    }));
    list.sort((a, b) => a.modified > b.modified ? -1 : 1);
    return list;
  }, [chatSessions]);

  const openSession = (id) => {
    const session = chatSessions[id];
    dispatch(setMessages({ messages: session.messages.map(formatMessage) }));
    setSelectedSession(session);
    setInitialModelParams({
      ...session.modelParams,
      models: session.modelParams?.models?.map(m => m.id),
      criticModels: session.modelParams?.criticModels?.map(m => m.id),
    });
    promptForm.setFieldsValue({
      promptSet: session.promptSetId,
      systemPrompt: session.systemPromptInput,
      critiquePromptSet: session.critiquePromptSetId,
      critiquePrompt: session.critiquePromptInput,
      criterion: session.criterion,
    });
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
    const {
      promptSet,
      systemPrompt,
      critiquePromptSet,
      critiquePrompt,
      criterion,
    } = await promptForm.validateFields();
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
          } else {
            if (nonSystemMessages.length > 0) {
              history = [
                ...nonSystemMessages,
                ...history,
              ];
            }
          }
          if (varsSchema) {
            args = { ...args, ...argsFormData };
          }
        } else {
          history = [
            ...ps.prompts.filter(p => p.role !== 'system').map(p => ({ role: p.role, content: p.prompt })),
            ...history,
          ];
        }
      } else {
        console.error(`prompt set with id (${promptSet}) not found or has no prompts`);
      }
    } else if (systemPrompt) {
      // TODO ignore variables?
      sp = systemPrompt;
    }
    dispatch(getChatResponseAsync({
      systemPrompt: sp,
      promptSetId: promptSet,
      systemPromptInput: systemPrompt,
      critiquePromptSetId: critiquePromptSet,
      critiquePromptInput: critiquePrompt,
      criterion: criterion,
      history,
      messages,
      originalMessages,
      args,
      engine,
      modelParams,
      workspaceId: selectedWorkspace.id,
    }));
  };

  const onCritique = async ({ input, completion }) => {
    let sp;
    let history = [...messages];
    let newMessages;
    let engine;
    let args;
    const { promptSet, systemPrompt, critiquePromptSet, critiquePrompt, criterion } = await promptForm.validateFields();
    if (critiquePromptSet) {
      const ps = promptSets[critiquePromptSet];
      if (ps && ps.prompts) {
        engine = ps.templateEngine || 'es6';
        sp = ps.prompts
          .filter(p => p.role === 'system')
          .map(p => p.prompt)
          .join('\n\n')
          ;
        if (critiqueContentVar || completionVar || criterionVar || critiqueVarsSchema) {
          const nonSystemMessages = ps.prompts
            .filter(p => p.role !== 'system')
            .map(p => ({ role: p.role, content: p.prompt }))
            ;
          if (critiqueContentVar) {
            if (nonSystemMessages.length > 1) {
              history = [
                ...history,
                ...nonSystemMessages.slice(0, -1),
              ];
            }
            newMessages = nonSystemMessages.slice(-1);
            args = { [critiqueContentVar]: input };
          } else {
            // TODO resend last message as new message following prompt,
            // or assume that prompt will refer to the last message?
            // if (nonSystemMessages.length > 0) {
            //   history = [
            //     ...history,
            //     ...nonSystemMessages,
            //   ];
            // }
            // newMessages = messages.slice(-1);
            if (nonSystemMessages.length > 1) {
              history = [
                ...messages,
                ...nonSystemMessages.slice(0, -1),
              ];
            }
            newMessages = nonSystemMessages.slice(-1);
          }
          if (completionVar) {
            args = { ...args, [completionVar]: completion };
          }
          if (criterionVar) {
            args = { ...args, [criterionVar]: criterion };
          }
          if (critiqueVarsSchema) {
            args = { ...args, ...argsFormData };
          }
        } else {
          history = [
            ...history,
            ...ps.prompts.filter(p => p.role !== 'system').map(p => ({ role: p.role, content: p.prompt })),
          ];
        }
      } else {
        console.error(`prompt set with id (${critiquePromptSet}) not found or has no prompts`);
      }
    } else if (critiquePrompt) {
      if (critiqueContentVar) {
        newMessages = [{ role: 'user', content: critiquePrompt }];
        args = { [critiqueContentVar]: input };
      } else {
        // TODO resend last message as new message following prompt,
        // or assume that prompt will refer to the last message?

        // TODO or send multiple messages instead?
        // history = [
        //   ...history,
        //   { role: 'user', content: critiquePrompt },
        // ];
        // newMessages = messages.slice(-1);
        newMessages = [{ role: 'user', content: critiquePrompt }];
      }
      if (completionVar) {
        args = { ...args, [completionVar]: completion };
      }
      if (criterionVar) {
        args = { ...args, [criterionVar]: criterion };
      }
      if (critiqueVarsSchema) {
        args = { ...args, ...argsFormData };
      }
    }
    dispatch(getChatResponseAsync({
      isCritic: true,
      systemPrompt: sp,
      promptSetId: promptSet,
      systemPromptInput: systemPrompt,
      critiquePromptSetId: critiquePromptSet,
      critiquePromptInput: critiquePrompt,
      criterion: criterion,
      history,
      messages: newMessages,
      originalMessages: messages,
      args,
      engine,
      modelParams,
      workspaceId: selectedWorkspace.id,
    }))
  };

  const handleCreateCancel = () => {
    setIsCreateModalOpen(false);
  };

  const onUseSelected = (msgs) => {
    setUsedMessages(msgs);
    setIsCreateModalOpen(true);
  };

  const onReset = () => {
    dispatch(setMessages({ messages: [] }));
    setSelectedSession(null);
    // dispatch(resetChatSessions());
    clearPromptFields();
    setInitialModelParams(initialModelParamsValue);
  };

  const clearPromptFields = () => {
    promptForm.resetFields();
  };

  const onSave = async () => {
    const { promptSet, systemPrompt } = await promptForm.validateFields();
    if (selectedSession && !(selectedSession.name === 'last session')) {
      dispatch(updateChatSessionAsync({
        id: selectedSession.id,
        values: {
          messages,
          modelParams,
          promptSetId: promptSet,
          systemPromptInput: systemPrompt,
          workspaceId: selectedWorkspace.id,
        },
      }));
    } else {
      const uuid = uuidv4();
      dispatch(createChatSessionAsync({
        uuid,
        values: {
          messages,
          modelParams,
          promptSetId: promptSet,
          systemPromptInput: systemPrompt,
          type: 'design',
          workspaceId: selectedWorkspace.id,
        },
      }));
      setCreatedUuid(uuid);
    }
  };

  // const findMessage = (key) => {
  //   for (const m of messages) {
  //     if (Array.isArray(m.content)) {
  //       const content = m.content.find(c => c.key === key);
  //       if (content) {
  //         return { message: m, content };
  //       }
  //     } else if (m.key === key) {
  //       return { message: m };
  //     }
  //   }
  //   return {};
  // };

  // const createMessages = (selectedKeys) => {
  //   return selectedKeys.map(key => {
  //     const { message, content } = findMessage(key);
  //     if (content) {
  //       return {
  //         role: message.role,
  //         content: content.content,
  //         key: content.key,
  //       };
  //     }
  //     return message;
  //   });
  // };

  const handleCreate = (values) => {
    // console.log('values:', values);
    if (selectedWorkspace) {

      // `selectedMessages` (keys) is unordered
      // const msgs = messages.filter((m) => selectedMessages.indexOf(m.key) !== -1);
      // const msgs = createMessages(selectedMessages);
      // const prompts = msgs.map((m) => ({
      //   prompt: m.content,
      //   role: m.role,
      // }));

      const prompts = usedMessages.map((m) => ({
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
              <Divider />
              <div style={{ display: 'flex' }}>
                <Form.Item
                  label="Critique Prompt Template"
                  name="critiquePromptSet"
                  style={{ marginBottom: 16, width: critiquePromptSetValue ? 202 : 234 }}
                >
                  <Select allowClear
                    loading={promptSetsLoading}
                    options={promptSetOptions}
                    optionFilterProp="label"
                  />
                </Form.Item>
                {critiquePromptSetValue ?
                  <Button
                    type="link"
                    icon={<LinkOutlined />}
                    onClick={() => navigate(`/prompt-sets/${critiquePromptSetValue}`)}
                    style={{ marginTop: 32, width: 32 }}
                  />
                  : null
                }
              </div>
              <Form.Item
                label="Critique prompt"
                name="critiquePrompt"
                extra="Instead of template"
              >
                <TextArea
                  autoSize={{ minRows: 4, maxRows: 14 }}
                  disabled={!!critiquePromptSetValue}
                />
              </Form.Item>
              <Form.Item
                label="Criteria"
                name="criterion"
              >
                <Select allowClear
                  options={criteriaOptions}
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
              enableCritique={enableCritique}
              loading={chatLoading}
              messages={messages}
              onCritique={onCritique}
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
              value={initialModelParams}
            />
          </Sider>
        </Layout>
      </div>
    </>
  );
}

const formatMessage = (m) => {
  if (Array.isArray(m.content)) {
    return {
      key: uuidv4(),
      role: m.role,
      content: m.content.map(msg => ({
        key: uuidv4(),
        content: msg.content,
        model: msg.model,
      })),
    };
  }
  return {
    key: uuidv4(),
    role: m.role,
    content: m.content,
  };
};

const inputTerms = ['input', 'text', 'content', 'query', 'question'];

const getInputProp = (props) => {
  return inputTerms.find(t => t in props);
};

const completionTerms = ['completion', 'response', 'result', 'answer'];

const getCompletionProp = (props) => {
  return completionTerms.find(t => t in props);
};

const criterionTerms = ['criterion', 'criteria'];

const getCritterionProp = (props) => {
  return criterionTerms.find(t => t in props);
};

const excludeProps = (props, schema) => {
  const schemaProps = { ...schema.properties };
  let required;
  if (schema.required) {
    required = [...schema.required];
  }
  for (const prop of props) {
    if (prop) {
      delete schemaProps[prop];
      if (required) {
        const index = required.indexOf(prop);
        if (index > -1) {
          required.splice(index, 1);
        }
      }
    }
  }
  if (Object.keys(schemaProps).length) {
    return {
      ...schema,
      properties: schemaProps,
      required,
    };
  }
  return null;
};
