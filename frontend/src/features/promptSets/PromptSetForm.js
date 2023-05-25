import { useContext, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Col,
  Collapse,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
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

import { SchemaModalInput } from '../../components/SchemaModalInput';
import { TagsInput } from '../../components/TagsInput';
import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import {
  createPromptSetAsync,
  getPromptSetAsync,
  selectLoaded,
  selectPromptSets,
  updatePromptSetAsync,
} from './promptSetsSlice';
import {
  createSettingAsync,
  getSettingAsync,
  selectSettings,
  updateSettingAsync,
} from './settingsSlice';

const { Panel } = Collapse;
const { TextArea } = Input;

const TAGS_KEY = 'promptSetTags';

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
      <Col span={12}>
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
          labelCol={{ span: 12 }}
          wrapperCol={{ span: 12, offset: index === 0 ? 0 : 12 }}
        >
          <Select options={roleOptions} allowClear />
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

  const newSkillInputRef = useRef(null);

  const loaded = useSelector(selectLoaded);
  const promptSets = useSelector(selectPromptSets);
  const settings = useSelector(selectSettings);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();

  const typesDefinedValue = Form.useWatch('isTypesDefined', form);

  const id = location.pathname.match(/\/prompt-sets\/(.*)/)[1];
  const isNew = id === 'new';
  const promptSet = promptSets[id];

  const skillOptions = skills.map((skill) => ({
    label: skill,
    value: skill,
  }));

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Prompts',
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

  const onCancel = () => {
    navigate('/prompt-sets');
  };

  const onFinish = (values) => {
    if (selectedWorkspace) {
      values = {
        ...values,
        workspaceId: selectedWorkspace.id,
        key: values.promptSetType,
      };
      if (isNew) {
        dispatch(createPromptSetAsync({ values }));
      } else {
        dispatch(updatePromptSetAsync({ id, values }));
      }
      updateExistingTags(values.tags || []);
      navigate('/prompt-sets');
    }
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
        <Form.Item wrapperCol={{ offset: 4, span: 8 }}>
          <div style={{ marginLeft: 35 }}>
            <Button
              icon={<PlusOutlined />}
              type="dashed"
              onClick={() => add()}
              style={{ width: '100%' }}
            >
              Add Prompt
            </Button>
            <Form.ErrorList errors={errors} />
          </div>
        </Form.Item>
      </>
    );
  }

  const PanelHeader = ({ title }) => (
    <div style={{ borderBottom: '1px solid #d9d9d9' }}>
      {title}
    </div>
  );

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <div style={{ marginTop: 20 }}>
      <Form
        {...layout}
        form={form}
        name="promptSets"
        autoComplete="off"
        onFinish={onFinish}
        initialValues={promptSet}
      >
        {/* <Collapse defaultActiveKey={['1']} ghost> */}
        {/* <Panel header={<PanelHeader title="Prompt Set Details" />} key="1" forceRender> */}
        <Form.Item
          label="Set Name"
          name="name"
          rules={[
            {
              required: true,
              message: 'Please enter a name',
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Skill"
          name="skill"
          rules={[
            {
              required: true,
              message: 'Please select a type',
            },
          ]}
        >
          <Select
            options={skillOptions}
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
          label="Tags"
          name="tags"
        >
          <TagsInput existingTags={existingTags} />
        </Form.Item>
        <Form.Item
          label="Description"
          name="description"
        >
          <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
        </Form.Item>
        {/* </Panel> */}
        {/* <Panel header={<PanelHeader title="Type Information" />} key="2" forceRender> */}
        <Form.Item
          colon={false}
          label="Define Types?"
          name="isTypesDefined"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        {typesDefinedValue ?
          <Form.Item
            label="Arguments"
            name="arguments"
          >
            <SchemaModalInput />
          </Form.Item>
          : null
        }
        {/* </Panel> */}
        {/* <Panel header={<PanelHeader title="Prompt Messages" />} key="3" forceRender> */}
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
        {/* </Panel> */}
        {/* </Collapse> */}
        <Form.Item wrapperCol={{ offset: 4 }}>
          <Space>
            <Button type="default" onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );

}
