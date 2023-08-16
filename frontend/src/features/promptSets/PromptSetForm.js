import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Col,
  Divider,
  Form,
  Input,
  Layout,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
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
import omit from 'lodash.omit';
import * as dayjs from 'dayjs';

import { SchemaModalInput } from '../../components/SchemaModalInput';
import { TagsInput } from '../../components/TagsInput';
import NavbarContext from '../../contexts/NavbarContext';
import UserContext from '../../contexts/UserContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { wordsDiff } from '../../utils/PatienceDiff';

import { VersionsModal } from '../apps/Playground/VersionsModal';

import { TemplateModal } from './TemplateModal';
import {
  createPromptSetAsync,
  getPromptSetAsync,
  selectLoaded,
  selectLoading,
  selectPromptSets,
  updatePromptSetAsync,
} from './promptSetsSlice';
import {
  createSettingAsync,
  getSettingAsync,
  selectSettings,
  updateSettingAsync,
} from './settingsSlice';

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
      <div style={{ width: 5 }}></div>
      <TextArea autoSize={{ minRows: 3, maxRows: 14 }} onChange={onChange} value={value} />
    </div>
  );
}

function SortableItem({ field, index, remove }) {

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Row ref={setNodeRef} style={style}>
      <Col span={14}>
        <Form.Item
          {...field}
          name={[field.name, 'prompt']}
          label={index === 0 ? 'Prompts' : ''}
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16, offset: index === 0 ? 0 : 8 }}
        >
          <PromptField attributes={attributes} listeners={listeners} />
        </Form.Item>
      </Col>
      <Col span={4}>
        <Form.Item
          name={[field.name, 'role']}
          label={index === 0 ? 'Role' : ''}
          labelCol={{ span: 10 }}
          wrapperCol={{ span: 14, offset: index === 0 ? 0 : 10 }}
        >
          <Select options={roleOptions} optionFilterProp="label" allowClear />
        </Form.Item>
      </Col>
      <Col span={1}>
        <div style={{ marginLeft: 16 }}>
          <Button type="text"
            icon={<CloseOutlined />}
            className="dynamic-delete-button"
            onClick={() => remove(field.name)}
          />
        </div>
      </Col>
    </Row>
  );
}

export function PromptSetForm() {

  const [existingTags, setExistingTags] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [skills, setSkills] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [tempForm, setTempForm] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);

  const newSkillInputRef = useRef(null);

  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const promptSets = useSelector(selectPromptSets);
  const settings = useSelector(selectSettings);

  const { setNavbarState } = useContext(NavbarContext);
  const { currentUser } = useContext(UserContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();

  const typesDefinedValue = Form.useWatch('isTypesDefined', form);
  const argumentsValue = Form.useWatch('arguments', form);
  const templateEngineValue = Form.useWatch('templateEngine', form);

  const vars = Object.keys(argumentsValue?.properties || {});

  const id = location.pathname.match(/\/prompt-sets\/(.*)/)[1];
  const isNew = id === 'new';
  const promptSet = promptSets[id];

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
            className={selectedVersion === key ? 'link-highlight' : ''}
          >
            {title}
          </Link>
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

  const openVersion = async (id) => {
    if (!tempForm) {
      const values = await form.validateFields();
      setTempForm(values);
    }
    const ver = promptSet.versions.find((v) => v.id === id);
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
    if (!isNew) {
      dispatch(getPromptSetAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getSettingAsync({
        workspaceId: selectedWorkspace.id,
        key: 'skills',
      }));
      dispatch(getSettingAsync({
        workspaceId: selectedWorkspace.id,
        key: TAGS_KEY,
      }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    const skillsSetting = settings['skills'];
    if (skillsSetting) {
      setSkills(skillsSetting.value || []);
    }
    const tagsSetting = settings[TAGS_KEY];
    if (tagsSetting) {
      setExistingTags(tagsSetting.value || []);
    }
  }, [settings]);

  const addNewSkill = (ev) => {
    ev.preventDefault();
    if (newSkill && selectedWorkspace) {
      const newSkills = [...skills, newSkill];
      setSkills(newSkills);
      setNewSkill('');
      const setting = settings['skills'];
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
    setTimeout(() => {
      newSkillInputRef.current?.focus();
    }, 0);
  };

  useEffect(() => {
    form.setFieldsValue(promptSet);
  }, [form, promptSet]);

  const useTemplate = (template) => {
    form.setFieldValue('isTypesDefined', template.isTypesDefined);
    form.setFieldValue('arguments', template.arguments);
    form.setFieldValue('prompts', template.prompts);
    setIsTemplateModalOpen(false);
  };

  const handleTemplateModalCancel = () => {
    setIsTemplateModalOpen(false);
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
    navigate('/prompt-sets');
  };

  const cleanVersion = (ver) => ({ ...ver, id: ver.id || uuidv4() });

  const saveAndCreateVersion = async () => {
    let values = await form.validateFields();
    const aWords = (promptSet.prompts || []).map(p => p.prompt).join(' ').split(/\s+/);
    const bWords = (values.prompts || []).map(p => p.prompt).join(' ').split(/\s+/);
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
    const setting = settings[TAGS_KEY];
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
        <Form.Item wrapperCol={{ offset: 4, span: 14 }}>
          <div style={{ marginLeft: 35 }}>
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
                  <Link to="https://handlebarsjs.com/guide/" target="_blank" rel="noopener noreferrer">See this guide</Link> for
                  a more indepth discussion.
                </div>
              </div>
              : null
            }
          </div>
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 4, span: 14 }}>
          <div style={{ marginLeft: 35 }}>
            <Button
              icon={<PlusOutlined />}
              onClick={() => add()}
              style={{ width: '100%' }}
              type="dashed"
            >
              Add Prompt
            </Button>
            <Form.ErrorList errors={errors} />
          </div>
        </Form.Item>
      </>
    );
  }

  const handleCancel = () => {
    setIsModalOpen(false);
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
    setIsModalOpen(false);
  };

  const showVersionsModal = (key) => {
    setIsModalOpen(true);
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
      <div style={{ height: '100%', marginTop: 20 }}>
        <Layout style={{ height: '100%' }}>
          <Sider
            style={{ height: '100%', marginRight: 20 }}
            width={250}
            theme="light"
          >
            <div style={{ margin: '24px 8px 16px' }}>
              <Space>
                <Button danger type="primary" size="small" onClick={handleRollback} disabled={!hasSelected}>
                  Rollback
                </Button>
                <Button type="primary" size="small" onClick={handleReset} disabled={!selectedVersion && !hasSelected}>
                  Reset
                </Button>
              </Space>
            </div>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={versions}
              loading={loading}
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
              <Form.Item
                label="Name"
                name="name"
                rules={[
                  {
                    required: true,
                    message: 'Please enter a name',
                  },
                ]}
                wrapperCol={{ span: 14 }}
              >
                <Input style={{ minWidth: 647 }} />
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
                  <Select
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
                  colon={false}
                  label="Template?"
                  name="isTemplate"
                  valuePropName="checked"
                  style={{ display: 'inline-block', margin: '0 0 0 16px' }}
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label="Tags"
                  name="tags"
                  style={{ display: 'inline-block', margin: '0 0 0 16px' }}
                >
                  <TagsInput existingTags={existingTags} />
                </Form.Item>
              </Form.Item>
              {currentUser?.roles?.includes('admin') ?
                <Form.Item
                  colon={false}
                  label="Public?"
                  name="isPublic"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                : null
              }
              <Form.Item
                label="Description"
                name="description"
                wrapperCol={{ span: 14 }}
              >
                <TextArea
                  autoSize={{ minRows: 1, maxRows: 14 }}
                  style={{ minWidth: 647 }}
                />
              </Form.Item>
              <Form.Item
                colon={false}
                label="Define Types?"
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
                    label="Arguments"
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
              <Form.Item wrapperCol={{ offset: 4 }}>
                <Space>
                  <Button type="default" onClick={onCancel}>Cancel</Button>
                  <Button type="primary" htmlType="submit">Save</Button>
                  <Button type="primary" onClick={saveAndCreateVersion} disabled={isNew}>Save &amp; Create Version</Button>
                  <Button type="default" onClick={showVersionsModal} disabled={isNew}>Versions</Button>
                  <Button type="default" onClick={() => setIsTemplateModalOpen(true)}>Use Template</Button>
                </Space>
              </Form.Item>
            </Form>
          </Content>
        </Layout>
      </div>
    </>
  );

}
