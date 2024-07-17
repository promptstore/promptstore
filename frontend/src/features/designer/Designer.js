import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Divider, Form, Input, Layout, Select, Table, Upload, message } from 'antd';
import {
  LinkOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import isEmpty from 'lodash.isempty';
import useLocalStorageState from 'use-local-storage-state';
import { v4 as uuidv4 } from 'uuid';

import { Chat } from '../../components/Chat';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getFunctionAsync,
  selectFunctions,
} from '../functions/functionsSlice';
import {
  createPromptSetAsync,
  getPromptSetsAsync,
  selectLoading as selectPromptSetsLoading,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';
import {
  fileUploadAsync,
  selectUploading,
} from '../uploader/fileUploaderSlice';

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
  getFunctionResponseAsync,
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
  // const [initialModelParams, setInitialModelParams] = useState({});
  const [argsFormData, setArgsFormData] = useState(null);
  const [sessionsCollapsed, setSessionsCollapsed] = useLocalStorageState('design-sessions-collapsed', { defaultValue: true });
  const [promptsCollapsed, setPromptsCollapsed] = useLocalStorageState('design-prompts-collapsed', { defaultValue: true });
  const [request, setRequest] = useState(null);

  const chatLoading = useSelector(selectChatLoading);
  const chatSessions = useSelector(selectChatSessions);
  const functions = useSelector(selectFunctions);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const messages = useSelector(selectMessages);
  const promptSets = useSelector(selectPromptSets);
  const promptSetsLoading = useSelector(selectPromptSetsLoading);
  const traceId = useSelector(selectTraceId);
  const uploading = useSelector(selectUploading);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

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
          const newSchema = excludeProps([contentVar], schema);
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
      title: 'Prompt Testing',
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
          dispatch(setMessages({ messages: lastSession.messages.filter(m => m).map(formatMessage) }));
          setSelectedSession(lastSession);
          // setInitialModelParams({
          //   ...lastSession.modelParams,
          //   models: lastSession.modelParams?.models?.map(m => m.id),
          //   criticModels: lastSession.modelParams?.criticModels?.map(m => m.id),
          // });
          setModelParams(lastSession.modelParams);
          promptForm.setFieldsValue({
            promptSet: lastSession.promptSetId,
            systemPrompt: lastSession.systemPromptInput,
            critiquePromptSet: lastSession.critiquePromptSetId,
            critiquePrompt: lastSession.critiquePromptInput,
            criterion: lastSession.criterion,
          });
          setArgsFormData(lastSession.argsFormData);
        }
      }
    }
  }, [loaded]);

  useEffect(() => {
    if (functions && request) {
      const func = functions[request.functionId];
      if (func) {
        request.functionName = func.name;
        dispatch(getFunctionResponseAsync(request));
      }
      setRequest(null);
    }
  }, [functions]);

  const promptSetOptions = useMemo(() => {
    if (promptSets) {
      const list = Object.values(promptSets).map((s) => ({
        key: s.id,
        label: s.name,
        value: s.id,
      }));
      list.sort((a, b) => a.label < b.label ? -1 : 1);
      return list;
    }
    return [];
  }, [promptSets]);

  const evalPromptSetOptions = useMemo(() => {
    if (promptSets) {
      const list = Object.values(promptSets)
        .filter(s => s.tags?.includes('eval'))
        .map((s) => ({
          key: s.id,
          label: s.name,
          value: s.id,
        }));
      list.sort((a, b) => a.label < b.label ? -1 : 1);
      return list;
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
    // setInitialModelParams({
    //   ...session.modelParams,
    //   models: session.modelParams?.models?.map(m => m.id),
    //   criticModels: session.modelParams?.criticModels?.map(m => m.id),
    // });
    setModelParams(session.modelParams);
    promptForm.setFieldsValue({
      promptSet: session.promptSetId,
      systemPrompt: session.systemPromptInput,
      critiquePromptSet: session.critiquePromptSetId,
      critiquePrompt: session.critiquePromptInput,
      criterion: session.criterion,
    });
    setArgsFormData(session.argsFormData);
  };

  const getInputStr = (messages) => {
    const message = messages[messages.length - 1];
    if (Array.isArray(message.content)) {
      const textContent = message.content.findLast(c => c.type === 'text');
      if (textContent) {
        return textContent.text;
      }
    }
    return null;
  };

  // ensure assistant messages have content arrays
  const cleanHistory = (history) => {
    const messages = [];
    for (const m of history) {
      if (m.role === 'assistant' && typeof m.content === 'string') {
        messages.push({ ...m, content: [m.content] });
      } else {
        messages.push(m);
      }
    }
    return messages;
  };

  const handleChatSubmit = async (values) => {
    if (!modelParams.models?.length) {
      messageApi.warning({
        content: 'You must select a valid model',
        duration: 5,
      });
      return;
    }
    const app = values.app;
    let history = [];
    let messages = values.messages;
    const originalMessages = messages;
    const index = messages.findLastIndex(m => m.role !== 'user') + 1;
    history = messages.slice(0, index);
    messages = messages.slice(index);
    if (app) {
      if (app.function) {
        const functionId = app.function;
        const userMessage = messages[messages.length - 1];
        const content = userMessage.content.replace(/@\w+/g, '');
        const payload = {
          functionId,
          args: { content },
          history,
          extraIndexes: app.indexes,
          params: { maxTokens: 1024 },
          workspaceId: selectedWorkspace.id,
        };
        setRequest(payload);
        dispatch(getFunctionAsync(functionId));
      }
    } else {
      let sp;
      let args;
      let engine;
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
            .flatMap(p => {
              if (typeof p.prompt === 'string') {
                return { type: 'text', text: p.prompt };
              }
              return p.prompt;
            });

          if (contentVar || varsSchema) {
            const nonSystemMessages = ps.prompts
              .filter(p => p.role !== 'system')
              .map(p => ({ role: p.role, content: p.prompt }))
              ;
            if (contentVar) {
              const content = getInputStr(messages);
              args = { [contentVar]: content };
              const idx = nonSystemMessages.findLastIndex(m => m.role !== 'user') + 1;
              if (nonSystemMessages.length > 1) {
                history = [
                  ...nonSystemMessages.slice(0, idx),
                  ...history,
                ];
              }
              messages = nonSystemMessages.slice(idx);
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
          history = cleanHistory(history);
        } else {
          console.error(`prompt set with id (${promptSet}) not found or has no prompts`);
        }
      } else if (systemPrompt) {
        // TODO ignore variables? allow both prompt set selection and additional system prompt content?
        sp = [
          {
            role: 'system',
            content: systemPrompt,
          }
        ];
      }
      if (messages.length > 1) {
        let content = [];
        for (const m of messages) {
          if (typeof m.content === 'string') {
            content.push({
              type: 'text',
              text: m.content,
            });
          } else {
            content.push(...m.content);
          }
        }
        messages = [
          {
            role: 'user',
            content,
          }
        ];
      }
      const payload = {
        systemPrompt: sp,
        promptSetId: promptSet,
        systemPromptInput: systemPrompt,
        critiquePromptSetId: critiquePromptSet,
        critiquePromptInput: critiquePrompt,
        criterion: criterion,
        history,
        messages,
        originalMessages: [...originalMessages.slice(0, index), ...messages],
        args,
        engine,
        modelParams,
        workspaceId: selectedWorkspace.id,
      };
      dispatch(getChatResponseAsync(payload));
    }
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
    // setInitialModelParams(initialModelParamsValue);
    setModelParams({
      ...initialModelParamsValue,
      models: initialModelParamsValue.models?.map(id => ({ id })),
      criticModels: initialModelParamsValue.criticModels?.map(id => ({ id })),
    });
    setArgsFormData(null);
  };

  const clearPromptFields = () => {
    promptForm.resetFields();
  };

  const onSave = async () => {
    const {
      promptSet,
      systemPrompt,
      critiquePromptSet,
      critiquePrompt,
      criterion,
    } = await promptForm.validateFields();
    if (selectedSession && !(selectedSession.name === 'last session')) {
      dispatch(updateChatSessionAsync({
        id: selectedSession.id,
        values: {
          argsFormData,
          messages,
          modelParams,
          promptSetId: promptSet,
          systemPromptInput: systemPrompt,
          critiquePromptSetId: critiquePromptSet,
          critiquePromptInput: critiquePrompt,
          criterion,
          workspaceId: selectedWorkspace.id,
        },
      }));
    } else {
      const uuid = uuidv4();
      dispatch(createChatSessionAsync({
        uuid,
        values: {
          argsFormData,
          messages,
          modelParams,
          promptSetId: promptSet,
          systemPromptInput: systemPrompt,
          critiquePromptSetId: critiquePromptSet,
          critiquePromptInput: critiquePrompt,
          criterion,
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

  const handleChange = (info) => {
    if (info.file.status === 'uploading') {
      return;
    }
    if (info.file.status === 'done') {
      dispatch(fileUploadAsync(selectedWorkspace.id, info.file, true));
    }
  };

  const uploadButton = (
    <div>
      {uploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>
        {uploading ? 'Uploading...' : 'Upload Image'}
      </div>
    </div>
  );

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [
      Table.SELECTION_ALL,
    ],
  };

  const hasSelected = selectedRowKeys.length > 0;
  const hasImage = messages
    .filter(m => m.role === 'user')
    .some(m => {
      if (Array.isArray(m.content)) {
        return m.content.some(c => c.type === 'image_url');
      }
      return false;
    });

  return (
    <>
      <CreatePromptSetModalForm
        open={isCreateModalOpen}
        onCancel={handleCreateCancel}
        onOk={handleCreate}
      />
      {contextHolder}
      <div style={{ height: '100%', marginTop: 20 }}>
        <Layout style={{ height: '100%' }}>
          <Sider
            collapsible
            collapsed={sessionsCollapsed}
            collapsedWidth={0}
            trigger={null}
            style={{
              borderRadius: 8,
              border: sessionsCollapsed ? '1px solid #f5f5f5' : '1px solid #f0f0f0',
              height: '100%',
              marginRight: 20,
            }}
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
            style={{
              borderRadius: 8,
              border: promptsCollapsed ? '1px solid #f5f5f5' : '1px solid #f0f0f0',
              height: '100%',
              marginRight: 20,
            }}
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
                  label="Eval Prompt Template"
                  name="critiquePromptSet"
                  style={{ marginBottom: 16, width: critiquePromptSetValue ? 202 : 234 }}
                >
                  <Select allowClear
                    loading={promptSetsLoading}
                    options={evalPromptSetOptions}
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
                label="Eval prompt"
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
          <Content style={{ minWidth: 325 }}>
            <div style={{ marginLeft: -8 }}>
              <Button
                type="text"
                icon={sessionsCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setSessionsCollapsed(cur => !cur)}
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
                onClick={() => setPromptsCollapsed(cur => !cur)}
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
              placeholder="Ask away..."
              traceId={traceId}
            />
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Upload
                name="upload"
                listType="picture-card"
                className="avatar-uploader"
                showUploadList={false}
                customRequest={dummyRequest}
                beforeUpload={beforeUpload}
                onChange={handleChange}
              >
                {uploadButton}
              </Upload>
            </div>
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
                  The message will be assigned to the `{contentVar}` variable if using a Prompt Template.
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
              hasImage={hasImage}
              includes={{
                maxTokens: true,
                temperature: true,
                topP: true,
                stopSequences: true,
                frequencyPenalty: true,
                presencePenalty: true,
                topK: true,
                jsonMode: true,
                seed: true,
                models: true,
                criticModels: true,
              }}
              onChange={setModelParams}
              // value={initialModelParams}
              value={modelParams}
            // value={{
            //   ...modelParams,
            //   models: modelParams.models?.map(m => m.id),
            //   criticModels: modelParams.criticModels?.map(m => m.id),
            // }}
            />
          </Sider>
        </Layout>
      </div>
    </>
  );
}

const formatMessage = (m) => {
  if (m.role === 'assistant') {
    if (Array.isArray(m.content)) {
      return {
        key: uuidv4(),
        role: m.role,
        content: m.content.map(msg => {
          if (typeof msg === 'string') {
            return {
              key: uuidv4(),
              content: msg,
            }
          } else {
            return {
              key: uuidv4(),
              content: msg.content,
              model: msg.model,
            }
          }
        }),
      };
    }
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

const beforeUpload = (file) => {
  // console.log('file:', file);

  const isPng = file.type === 'image/png';

  const isJpg = file.type === 'image/jpeg';

  if (!(isPng || isJpg)) {
    message.error('You may only upload an image file.');
  }

  const isLt2M = file.size / 1024 / 1024 < 100;

  if (!isLt2M) {
    message.error('File must be smaller than 100Mb.');
  }

  return (isPng || isJpg) && isLt2M;
};

// https://stackoverflow.com/questions/51514757/action-function-is-required-with-antd-upload-control-but-i-dont-need-it
const dummyRequest = ({ file, onSuccess }) => {
  setTimeout(() => {
    onSuccess('ok');
  }, 20);
};
