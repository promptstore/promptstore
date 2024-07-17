import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Collapse,
  Divider,
  Dropdown,
  Form,
  Image,
  Input,
  Layout,
  List,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
  message,
} from 'antd';
import {
  BlockOutlined,
  CommentOutlined,
  CloseOutlined,
  DownloadOutlined,
  LoadingOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';
import * as dayjs from 'dayjs';
import omit from 'lodash.omit';
import snakeCase from 'lodash.snakecase';

import Download from '../../components/Download';
import { SchemaModalInput } from '../../components/SchemaModalInput';
import { TagsInput } from '../../components/TagsInput';
import NavbarContext from '../../contexts/NavbarContext';
import UserContext from '../../contexts/UserContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { wordsDiff } from '../../utils/PatienceDiff';

import { VersionsModal } from '../apps/Playground/VersionsModal';
import {
  selectMessages,
} from '../designer/chatSlice';
import {
  getFunctionsByPromptSetAsync,
  resetFunctions,
  selectFunctions,
} from '../functions/functionsSlice';
import {
  createSettingAsync,
  getSettingsAsync,
  selectSettings,
  updateSettingAsync,
} from '../settings/settingsSlice';
import {
  duplicateObjectAsync,
  fileUploadAsync,
  selectUploading,
} from '../uploader/fileUploaderSlice';

import { SnippetModal } from './SnippetModal';
import { TemplateModal } from './TemplateModal';
import {
  createPromptSetAsync,
  getPromptSetAsync,
  selectLoaded,
  selectLoading,
  selectPromptSets,
  updatePromptSetAsync,
} from './promptSetsSlice';

const { TextArea } = Input;
const { Content, Sider } = Layout;

const TAGS_KEY = 'promptSetTags';
const TIME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const roleOptions = [
  {
    label: 'System',
    value: 'system',
  },
  {
    label: 'Assistant',
    value: 'assistant',
  },
  {
    label: 'User',
    value: 'user',
  },
];

const templateEngineOptions = [
  {
    label: 'Handlebars',
    value: 'handlebars',
  },
  {
    label: 'ES6',
    value: 'es6',
  },
];

function PromptField({ attributes, listeners, onChange, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <button className="drag-handle" {...listeners} {...attributes}>
        <svg viewBox="0 0 20 20" width="12">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
        </svg>
      </button>
      {Array.isArray(value) ?
        <Image src={value[0].image_url.url} width={200} />
        :
        <TextArea
          autoSize={{ minRows: 3, maxRows: 14 }}
          onChange={onChange}
          placeholder="Prompt"
          value={value}
        />
      }
    </div>
  );
}

function SortableItem({ field, index, remove }) {

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.key,
  });

  const style = {
    display: 'flex',
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ flex: 1 }}>
        <Form.Item
          {...field}
          name={[field.name, 'prompt']}
        >
          <PromptField attributes={attributes} listeners={listeners} />
        </Form.Item>
      </div>
      <div style={{ width: 100, marginLeft: 8 }}>
        <Form.Item
          name={[field.name, 'role']}
          initialValue="user"
        >
          <Select allowClear
            optionFilterProp="label"
            options={roleOptions}
            placeholder="Role"
          />
        </Form.Item>
      </div>
      <div style={{ width: 32, marginLeft: 0 }}>
        <Button type="text"
          icon={<CloseOutlined />}
          className="dynamic-delete-button"
          onClick={() => remove(field.name)}
        />
      </div>
    </div>
  );
}

export function PromptSetForm() {

  const [backOnSave, setBackOnSave] = useState(false);
  const [correlationId, setCorrelationId] = useState(null);
  const [existingTags, setExistingTags] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [skills, setSkills] = useState([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isSnippetModalOpen, setSnippetModalOpen] = useState(false);
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [tempForm, setTempForm] = useState(null);
  const [selectedSnippet, setSelectedSnippet] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);

  const newSkillInputRef = useRef(null);

  const functions = useSelector(selectFunctions);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const messages = useSelector(selectMessages);
  const promptSets = useSelector(selectPromptSets);
  const settings = useSelector(selectSettings);
  const uploading = useSelector(selectUploading);

  const { setNavbarState } = useContext(NavbarContext);
  const { currentUser } = useContext(UserContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const [form] = Form.useForm();

  const typesDefinedValue = Form.useWatch('isTypesDefined', form);
  const argumentsValue = Form.useWatch('arguments', form);
  const templateEngineValue = Form.useWatch('templateEngine', form);

  const vars = Object.keys(argumentsValue?.properties || {});

  const id = location.pathname.match(/\/prompt-sets\/(.*)\/edit/)[1];
  const isNew = id === 'new';
  let promptSet = promptSets[id];

  // console.log('promptSet:', promptSet);
  // console.log('skills:', skills);

  const skillOptions = useMemo(() => {
    const list = skills.map((skill) => ({
      label: skill,
      value: skill,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [skills]);

  const versions = useMemo(() => {
    if (!promptSet?.versions) return [];
    const vs = promptSet.versions.map(s => ({
      key: s.id,
      title: s.title,
      created: s.created,
      username: s.username,
      promptSet: s.promptSet,
    }));
    vs.sort((a, b) => a.created < b.created ? 1 : -1);
    return vs;
  }, [promptSet]);

  const columns = [
    {
      title: 'Versions',
      dataIndex: 'title',
      width: '100%',
      render: (_, { key, created, title }) => (
        <div>
          <Link
            onClick={() => openVersion(key)}
            className={(selectedVersion === key ? 'link-highlight' : '') + 'slider-list-item'}
            style={{ width: 186 }}
          >
            {title}
          </Link>
          <div
            className="text-secondary"
            style={{ marginTop: 5 }}
          >
            {dayjs(created).format(TIME_FORMAT)}
          </div>
        </div >
      )
    },
  ];

  const environmentOptions = useMemo(() => {
    const setting = Object.values(settings).find(s => s.key === 'environments');
    if (setting) {
      return setting.value.map(s => ({
        label: s,
        value: s,
      }));
    }
    return [];
  }, [settings]);

  const functionsList = useMemo(() => {
    return Object.values(functions).map(f => ({
      id: f.id,
      name: f.name,
    }));
  }, [functions]);

  const snippetsList = useMemo(() => {
    const setting = Object.values(settings).find(s => s.key === 'snippets');
    if (setting) {
      return setting.value.map(s => ({
        id: s.key,
        name: s.key,
      }));
    }
    return [];
  }, [settings]);

  const openVersion = async (id) => {
    if (!tempForm) {
      const values = await form.validateFields();
      setTempForm(values);
    }
    const ver = promptSet.versions.find((v) => v.id === id);
    // not sure why this line is needed
    // otherwise nested properties in `arguments` are not updated
    form.setFieldValue('arguments', null);
    form.setFieldsValue(ver.promptSet);
    setSelectedVersion(id);
  };

  const handleReset = () => {
    if (tempForm) {
      form.setFieldsValue(tempForm);
      setTempForm(null);
      setSelectedVersion(null);
    }
    setSelectedRowKeys([]);
  };

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Prompt Template',
    }));
    if (isNew) {
      dispatch(resetFunctions());
    } else {
      dispatch(getPromptSetAsync(id));
    }
  }, []);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 5,
      });
    }
  }, [location]);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getSettingsAsync({
        key: ['environments', 'skills', 'snippets', TAGS_KEY],
        workspaceId,
      }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    const skillsSetting = Object.values(settings).find(s => s.key === 'skills');
    if (skillsSetting) {
      setSkills(skillsSetting.value || []);
    }
    const tagsSetting = Object.values(settings).find(s => s.key === TAGS_KEY);
    if (tagsSetting) {
      setExistingTags(tagsSetting.value || []);
    }
  }, [settings]);

  useEffect(() => {
    if (backOnSave) {
      setBackOnSave(false);
      navigate('/prompt-sets');
    }
    if (correlationId) {
      const ps = Object.values(promptSets).find(s => s.correlationId === correlationId);
      if (ps) {
        navigate(`/prompt-sets/${ps.id}/edit`);
        setCorrelationId(null);
      }
    }
  }, [promptSets]);

  const addNewSkill = (ev) => {
    ev.preventDefault();
    if (newSkill && selectedWorkspace) {
      const newSkills = [...skills, newSkill];
      setSkills(newSkills);
      setNewSkill('');
      const setting = Object.values(settings).find(s => s.key === 'skills');
      const values = {
        workspaceId: selectedWorkspace.id,
        key: 'skills',
        value: newSkills,
      };
      if (setting) {
        dispatch(updateSettingAsync({ id: setting.id, values }));
      } else {
        dispatch(createSettingAsync({ values }));
      }
    }
    // setTimeout(() => {
    //   newSkillInputRef.current?.focus();
    // }, 0);
  };

  useEffect(() => {
    form.setFieldsValue(promptSet);
  }, [form, promptSet]);

  useEffect(() => {
    if (promptSet) {
      dispatch(getFunctionsByPromptSetAsync({
        workspaceId: selectedWorkspace.id,
        promptSetId: promptSet.id,
      }));
    }
  }, [promptSet]);

  useEffect(() => {
    if (promptSet && messages?.length) {
      const prompts = messages.map(m => ({
        role: m.role,
        prompt: m.content,
      }));
      console.log('prompts:', prompts)
      form.setFieldValue('prompts', [...(promptSet.prompts || []), ...prompts]);
    }
  }, [messages]);

  const createSnippet = () => {
    setSnippetModalOpen(true);
  };

  const useTemplate = (template) => {
    form.setFieldValue('isTypesDefined', template.isTypesDefined);
    form.setFieldValue('arguments', template.arguments);
    form.setFieldValue('prompts', template.prompts);
    setTemplateModalOpen(false);
  };

  const handleSnippetCreate = (form) => {
    const { key, content } = form;
    const setting = Object.values(settings).find(s => s.key === 'snippets');
    if (setting) {
      const value = [...setting.value];
      const index = value.findIndex(s => s.key === key);
      if (index > -1) {
        value.splice(index, 1, {
          ...value[index],
          key,
          content,
          modified: (new Date()).toISOString(),
          modifiedBy: currentUser.username,
        });
      } else {
        value.push({
          id: uuidv4(),
          key,
          content,
          created: (new Date()).toISOString(),
          createdBy: currentUser.username,
        });
      }
      const values = { value };
      dispatch(updateSettingAsync({ id: setting.id, values }));
    } else {
      const value = [
        {
          id: uuidv4(),
          key,
          content,
          created: (new Date()).toISOString(),
          createdBy: currentUser.username,
        },
      ];
      const values = {
        workspaceId: selectedWorkspace.id,
        key: 'snippets',
        value,
      };
      dispatch(createSettingAsync({ values }));
    }
    setSnippetModalOpen(false);
  };

  const handleSnippetDelete = (key) => {
    if (key) {
      const setting = Object.values(settings).find(s => s.key === 'snippets');
      if (setting) {
        const value = [...setting.value];
        const index = value.findIndex(s => s.key === key);
        if (index > -1) {
          value.splice(index, 1);
          const values = { value };
          dispatch(updateSettingAsync({ id: setting.id, values }));
          setSnippetModalOpen(false);
        }
      }
    }
  };

  const handleSnippetEdit = (key) => {
    const setting = Object.values(settings).find(s => s.key === 'snippets');
    if (setting) {
      const value = setting.value || [];
      const snippet = value.find(s => s.key === key);
      if (snippet) {
        setSelectedSnippet(snippet);
        setSnippetModalOpen(true);
      }
    }
  };

  const handleSnippetModalCancel = () => {
    setSnippetModalOpen(false);
  }

  const handleTemplateModalCancel = () => {
    setTemplateModalOpen(false);
  };

  const onCancel = () => {
    navigate('/prompt-sets');
  };

  const onFinish = (values) => {
    if (isNew) {
      if (selectedWorkspace) {
        values = {
          ...values,
          workspaceId: selectedWorkspace.id,
          key: values.skill,
        };
        dispatch(createPromptSetAsync({ values }));
      }
    } else {
      values = {
        ...promptSet,
        ...values,
        key: values.skill,
      };
      dispatch(updatePromptSetAsync({ id, values }));
    }
    updateExistingTags(values.tags || []);
    // setBackOnSave(true);
  };

  const cleanVersion = (ver) => ({ ...ver, id: ver.id || uuidv4() });

  const saveAndCreateVersion = async () => {
    let values = await form.validateFields();
    let versions = promptSet.versions;
    let diff;
    if (versions && versions.length) {
      const previousVersion = versions[versions.length - 1];
      const aWords = (previousVersion.promptSet.prompts || []).map(p => p.prompt).join(' ').split(/\s+/);
      const bWords = (promptSet.prompts || []).map(p => p.prompt).join(' ').split(/\s+/);
      // TODO get the words in `bWords` that are different
      diff = wordsDiff(aWords, bWords, 5);
    } else {
      diff = ['Initial', 'version'];
    }
    if (diff.length) {
      const title = diff.join(' ');
      versions = [
        ...(versions || []).map(cleanVersion),
        {
          id: uuidv4(),
          created: (new Date()).toISOString(),
          promptSet: omit(promptSet, ['versions']),
          title,
          username: currentUser.username,
          version: (versions || []).length + 1,
        },
      ];
    }
    values = {
      ...values,
      key: values.skill,
      versions,
    };
    dispatch(updatePromptSetAsync({ id, values }));
    updateExistingTags(values.tags || []);
    navigate('/prompt-sets');
  };

  const updateExistingTags = (tags) => {
    const setting = Object.values(settings).find(s => s.key === TAGS_KEY);
    const newTags = [...new Set([...existingTags, ...tags])];
    newTags.sort((a, b) => a < b ? -1 : 1);
    const values = {
      workspaceId: selectedWorkspace.id,
      key: TAGS_KEY,
      value: newTags,
    };
    if (setting) {
      dispatch(updateSettingAsync({ id: setting.id, values }));
    } else {
      dispatch(createSettingAsync({ values }));
    }
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 15px' }}>
      {uploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div>
        {uploading ? 'Uploading...' : 'Upload Image'}
      </div>
    </div>
  );

  const onNewSkillChange = (ev) => {
    setNewSkill(ev.target.value);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function Code({ children }) {
    return (
      <code style={{ color: 'chocolate', fontSize: '0.9em', whiteSpace: 'nowrap' }}>{children}</code>
    );
  }

  function PromptList({ fields, errors, add, move, remove }) {

    const [activeId, setActiveId] = useState(null);

    const handleDragStart = (ev) => {
      setActiveId(ev.active.id);
    };

    const handleDragEnd = ({ active, over }) => {
      setActiveId(null);
      if (active.id !== over.id) {
        const from = fields.findIndex(f => f.key === active.id);
        const to = fields.findIndex(f => f.key === over.id);
        move(from, to);
      }
    }

    return (
      <>
        {contextHolder}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={fields} strategy={verticalListSortingStrategy}>
            {fields.map((field, index) => (
              <SortableItem key={field.key}
                field={field}
                index={index}
                remove={remove}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <SortableItem
                field={fields.find(f => f.key === activeId)}
                index={fields.findIndex(f => f.key === activeId)}
                remove={remove}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
        <Form.Item>
          <div style={{ marginLeft: 30 }}>
            <Button
              icon={<PlusOutlined />}
              onClick={() => add()}
              style={{ width: '100%' }}
              type="dashed"
            >
              Add Message
            </Button>
            <Form.ErrorList errors={errors} />
          </div>
        </Form.Item>
        <Form.Item>
          <div style={{ marginLeft: 30 }}>
            <Upload
              name="upload"
              listType="picture-card"
              className="avatar-uploader"
              showUploadList={false}
              customRequest={dummyRequest}
              // beforeUpload={beforeUpload}
              onChange={handleChange}
            >
              {uploadButton}
            </Upload>
          </div>
        </Form.Item>
        <Form.Item style={{ marginBottom: 0, marginTop: -24 }}>
          <div style={{ marginLeft: 30 }}>
            <Collapse
              bordered={false}
              style={{ background: 'transparent' }}
              items={[
                {
                  key: 1,
                  label: 'Help',
                  children: (
                    <>
                      <Space direction="horizontal" wrap={true}>
                        <span style={{ whiteSpace: 'nowrap' }}>Available variables:</span>
                        <Tag key="maxTokens">maxTokens</Tag>
                        {vars.map((v) => (
                          <Tag key={v}>{v}</Tag>
                        ))}
                      </Space>
                      {templateEngineValue === 'es6' ?
                        <div className="prompt-help">
                          <div>
                            Use <Code>{'${<var>}'}</Code> notation to insert a variable.
                          </div>
                        </div>
                        : null
                      }
                      {templateEngineValue === 'handlebars' ?
                        <div className="prompt-help">
                          <div>
                            Use <Code>{'{{<var>}}'}</Code> notation to insert a variable.
                            Wrap a conditional block using:
                          </div>
                          <div>
                            <Code>{'{{#if <var>}}<text-block>{{else}}<alt-block>{{/if}}'}</Code>
                          </div>
                          <div>
                            or if testing that a variable is a non-empty list:
                          </div>
                          <div>
                            <Code>{'{{#ifmulitple <var>}}<text-block>{{else}}<alt-block>{{/if}}'}</Code>
                          </div>
                          <div>
                            To enumerate a list variable as a comma-separated list,
                            use: <Code>{'{{list <var>}}'}</Code>
                          </div>
                          <div>
                            <Link to={process.env.REACT_APP_HANDLEBARS_GUIDE_URL} target="_blank" rel="noopener noreferrer">See this guide</Link> for
                            a more indepth discussion.
                          </div>
                        </div>
                        : null
                      }
                    </>
                  )
                }
              ]}
            />
          </div>
        </Form.Item>
      </>
    );
  }

  const handleCancel = () => {
    setModalOpen(false);
  };

  const handleDuplicate = async () => {
    const correlationId = uuidv4();
    const values = await form.validateFields();
    const obj = { ...promptSet, ...values };
    dispatch(duplicateObjectAsync({
      correlationId,
      obj,
      type: 'promptSet',
      workspaceId: selectedWorkspace.id,
    }));
    setCorrelationId(correlationId);
  };

  const handleRollback = () => {
    handleVersionRollback(selectedRowKeys[0]);
  };

  const handleVersionRollback = (selectedVersion) => {
    const ver = promptSet.versions.find((v) => v.id === selectedVersion);
    if (ver) {
      const aWords = (promptSet.prompts || []).map(p => p.prompt).join(' ').split(/\s+/);
      const bWords = (ver.promptSet.prompts || []).map(p => p.prompt).join(' ').split(/\s+/);
      const diff = wordsDiff(aWords, bWords, 5);
      let versions = promptSet.versions;
      if (diff.length) {
        const title = diff.join(' ');
        versions = [
          ...(versions || []).map(cleanVersion),
          {
            id: uuidv4(),
            created: (new Date()).toISOString(),
            promptSet: omit(promptSet, ['versions']),
            title,
            username: currentUser.username,
            version: (versions || []).length + 1,
          },
        ];
      }
      const values = {
        ...ver.promptSet,
        versions,
      };
      dispatch(updatePromptSetAsync({ id, values }));
      updateExistingTags(values.tags || []);
    }
    setModalOpen(false);
  };

  const showVersionsModal = (key) => {
    setModalOpen(true);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    type: 'radio',
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const hasSelected = selectedRowKeys.length > 0;

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      <VersionsModal
        handleCancel={handleCancel}
        onVersionRollback={handleVersionRollback}
        open={isModalOpen}
        selectedRow={promptSet}
        width={600}
        keyProp="id"
        valueProp="id"
        titleProp="title"
      />
      <TemplateModal
        onCancel={handleTemplateModalCancel}
        onSubmit={useTemplate}
        open={isTemplateModalOpen}
      />
      <SnippetModal
        onCancel={handleSnippetModalCancel}
        onDelete={handleSnippetDelete}
        onSubmit={handleSnippetCreate}
        open={isSnippetModalOpen}
        value={selectedSnippet}
        width={800}
      />
      <div id="promptset-form" style={{ marginTop: 20 }}>
        <Layout>
          <Sider
            style={{ height: 'fit-content', marginRight: 20 }}
            width={250}
            theme="light"
          >
            <div style={{ margin: '24px 8px 16px' }}>
              <Space>
                <Button danger type="primary" size="small"
                  disabled={!hasSelected}
                  onClick={handleRollback}
                >
                  Rollback
                </Button>
                <Button type="primary" size="small"
                  disabled={!selectedVersion && !hasSelected}
                  onClick={handleReset}
                >
                  Reset
                </Button>
              </Space>
            </div>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={versions}
              loading={loading}
              pagination={false}
            />
            <List
              header={<div>Semantic Functions</div>}
              dataSource={functionsList}
              renderItem={(item) => (
                <List.Item>
                  <Link to={`/functions/${item.id}/edit`}>{item.name}</Link>
                </List.Item>
              )}
            />
            <div style={{ margin: '24px 8px 16px' }}>
              <Space>
                <Button type="primary" size="small"
                  icon={<PlusOutlined />}
                  onClick={createSnippet}
                >
                  Snippet
                </Button>
              </Space>
            </div>
            <List
              header={<div>Snippets</div>}
              dataSource={snippetsList}
              renderItem={(item) => (
                <List.Item>
                  <Link
                    onClick={() => handleSnippetEdit(item.id)}
                  >
                    {item.name}
                  </Link>
                </List.Item>
              )}
            />
          </Sider>
          <Content>
            <Form
              {...layout}
              form={form}
              name="promptSets"
              autoComplete="off"
              onFinish={onFinish}
              initialValues={promptSet}
            >
              <Form.Item wrapperCol={{ span: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 16 }}>
                  {!isNew ?
                    <>
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
                                <Download filename={snakeCase(promptSet?.name) + '.json'} payload={promptSet}>
                                  <Link>Export</Link>
                                </Download>
                              )
                            },
                            {
                              key: 'test',
                              icon: <CommentOutlined />,
                              label: (
                                <Link to={`/design/${id}`}>Test</Link>
                              ),
                            },
                          ]
                        }}
                      >
                        <MoreOutlined />
                      </Dropdown>
                      <Link to={`/prompt-sets/${id}`}>View</Link>
                    </>
                    : null
                  }
                  <Link to={`/prompt-sets`}>List</Link>
                </div>
              </Form.Item>
              <Form.Item
                label="Name"
                name="name"
                rules={[
                  {
                    required: true,
                    message: 'Please enter a name',
                  },
                ]}
                wrapperCol={{ span: 16 }}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Skill"
                required
              >
                <Form.Item
                  name="skill"
                  rules={[
                    {
                      required: true,
                      message: 'Please select a type',
                    },
                  ]}
                  style={{ display: 'inline-block', margin: 0, width: 300 }}
                >
                  <Select allowClear
                    options={skillOptions}
                    optionFilterProp="label"
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <Divider style={{ margin: '8px 0' }} />
                        <Space style={{ padding: '0 8px 4px' }}>
                          <Input
                            placeholder="Please enter new skill"
                            ref={newSkillInputRef}
                            value={newSkill}
                            onChange={onNewSkillChange}
                          />
                          <Button type="text" icon={<PlusOutlined />} onClick={addNewSkill}>
                            Add skill
                          </Button>
                        </Space>
                      </>
                    )}
                  />
                </Form.Item>
                <Form.Item
                  label="Template"
                  name="isTemplate"
                  valuePropName="checked"
                  style={{ display: 'inline-block', margin: '0 0 0 16px' }}
                >
                  <Switch />
                </Form.Item>
                {currentUser?.roles?.includes('admin') ?
                  <Form.Item
                    label="Public"
                    name="isPublic"
                    valuePropName="checked"
                    style={{ display: 'inline-block', margin: '0 0 0 16px' }}
                  >
                    <Switch />
                  </Form.Item>
                  : null
                }
              </Form.Item>
              <Form.Item
                label="Description"
                name="description"
                wrapperCol={{ span: 16 }}
              >
                <TextArea
                  autoSize={{ minRows: 1, maxRows: 14 }}
                />
              </Form.Item>
              <Form.Item
                label="Environment"
              >
                <Form.Item
                  name="environment"
                  style={{ display: 'inline-block', margin: 0, width: 300 }}
                >
                  <Select allowClear
                    optionFilterProp="label"
                    options={environmentOptions}
                  />
                </Form.Item>
                <Form.Item
                  label="Tags"
                  name="tags"
                  style={{ display: 'inline-block', margin: '0 0 0 16px' }}
                >
                  <TagsInput existingTags={existingTags} />
                </Form.Item>
              </Form.Item>
              <Form.Item
                label="Schema"
              >
                <Form.Item
                  name="isTypesDefined"
                  valuePropName="checked"
                  style={{ display: 'inline-block', margin: 0 }}
                >
                  <Switch />
                </Form.Item>
                {typesDefinedValue ?
                  <Form.Item
                    label="Variables"
                    name="arguments"
                    style={{ display: 'inline-block', margin: '0 0 0 16px' }}
                  >
                    <SchemaModalInput />
                  </Form.Item>
                  : null
                }
              </Form.Item>
              <Form.Item
                label="Template Engine"
                name="templateEngine"
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={templateEngineOptions}
                />
              </Form.Item>
              <Form.Item
                label="Prompts"
                wrapperCol={{ span: 16 }}
              >
                <Form.List name="prompts">
                  {(fields, { add, move, remove }, { errors }) => (
                    <PromptList
                      fields={fields}
                      add={add}
                      move={move}
                      remove={remove}
                      errors={errors}
                    />
                  )}
                </Form.List>
              </Form.Item>
              <Form.Item wrapperCol={{ offset: 4 }}>
                <Space>
                  <Button type="default" onClick={onCancel}>Cancel</Button>
                  <Button type="primary" htmlType="submit">Save</Button>
                  <Button type="primary" onClick={saveAndCreateVersion} disabled={isNew}>Save &amp; Create Version</Button>
                  <Button type="default" onClick={showVersionsModal} disabled={isNew}>Versions</Button>
                  <Button type="default" onClick={() => setTemplateModalOpen(true)}>Use Template</Button>
                </Space>
              </Form.Item>
            </Form>
          </Content>
        </Layout>
      </div>
    </>
  );

}

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
