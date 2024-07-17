import { useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Col, Form, Input, Row, Select, Space, Switch, Tag } from 'antd';
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

import JsonInput from '../../components/JsonInput';
import { TagsInput } from '../../components/TagsInput';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  createSettingAsync,
  getSettingAsync,
  getSettingByKeyAsync,
  selectLoaded,
  selectSettings,
  updateSettingAsync,
} from './settingsSlice';

const { TextArea } = Input;

const TAGS_KEY = 'SETTING_TAGS';

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const typeOptions = [
  {
    label: 'String',
    value: 'string',
  },
  {
    label: 'Number',
    value: 'number',
  },
  {
    label: 'JSON',
    value: 'json',
  },
  {
    label: 'Options',
    value: 'options',
  },
];

export function SettingsForm() {

  const [error, setError] = useState(null);
  const [existingTags, setExistingTags] = useState([]);

  const loaded = useSelector(selectLoaded);
  const settings = useSelector(selectSettings);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  let id = location.pathname.match(/\/settings\/(.*)/)[1];
  const isNew = id === 'new';
  if (!isNew) {
    id = parseInt(id, 10);
  }
  const setting = settings[id];

  const [form] = Form.useForm();

  const settingType = Form.useWatch('settingType', form);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Setting',
    }));
    dispatch(getSettingByKeyAsync(selectedWorkspace.id, TAGS_KEY));
    if (!isNew) {
      dispatch(getSettingAsync(id));
    }
  }, []);

  useEffect(() => {
    const tagsSetting = Object.values(settings).find(s => s.key === TAGS_KEY);
    if (tagsSetting) {
      setExistingTags(tagsSetting.value || []);
    }
  }, [settings]);

  const onCancel = () => {
    navigate('/settings');
  };

  const onFinish = (values) => {
    // delay save in case of JSON parse error
    setTimeout(() => {
      if (error) {
        setError(null);
        return;
      }
      values = {
        ...values,
        workspaceId: selectedWorkspace.id,
      };
      if (isNew) {
        dispatch(createSettingAsync({ values }));
      } else {
        dispatch(updateSettingAsync({ id, values }));
      }
      updateExistingTags(values.tags || []);
      navigate('/settings');
    }, 200);
  };

  const updateExistingTags = (tags) => {
    // console.log('settings:', settings);
    const setting = Object.values(settings).find(s => s.key === TAGS_KEY);
    // console.log('setting:', setting, TAGS_KEY);
    const newTags = [...new Set([...existingTags, ...tags])];
    newTags.sort((a, b) => a < b ? -1 : 1);
    const values = {
      workspaceId: selectedWorkspace.id,
      name: 'Setting Tags',
      settingType: 'string',
      key: TAGS_KEY,
      value: newTags,
    };
    if (setting) {
      dispatch(updateSettingAsync({ id: setting.id, values }));
    } else {
      dispatch(createSettingAsync({ values }));
    }
  };

  function DragHandle({ attributes, listeners }) {
    return (
      <div style={{ paddingTop: 1 }}>
        <button className="drag-handle" {...listeners} {...attributes}>
          <svg viewBox="0 0 20 20" width="12">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
          </svg>
        </button>
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
        <Col span={24}>
          <Form.Item
            key={field.key}
            label={index === 0 ? 'Options' : ''}
            wrapperCol={{ offset: index === 0 ? 0 : 4 }}
          >
            <Space>
              <DragHandle attributes={attributes} listeners={listeners} />
              <Form.Item
                label="Label"
                colon={false}
                name={[field.name, 'label']}
                style={{ marginBottom: 0 }}
              >
                <Input style={{ width: 350 }} />
              </Form.Item>
              <Form.Item
                label="Value"
                colon={false}
                name={[field.name, 'value']}
                style={{ marginBottom: 0, marginLeft: 8 }}
              >
                <Input style={{ width: 350 }} />
              </Form.Item>
              <Button type="text"
                icon={<CloseOutlined />}
                className="dynamic-delete-button"
                onClick={() => remove(field.name)}
              />
            </Space>
          </Form.Item>
        </Col>
      </Row>
    );
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function OptionsList({ fields, errors, add, move, remove }) {

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
            {activeId ?
              <SortableItem
                field={fields.find(f => f.key === activeId)}
                index={fields.findIndex(f => f.key === activeId)}
                remove={remove}
              />
              : null
            }
          </DragOverlay>
        </DndContext>
        <Form.Item wrapperCol={{ offset: 4 }}>
          <Button
            type="dashed"
            onClick={() => add()}
            style={{ width: 575, zIndex: 101 }}
            icon={<PlusOutlined />}
          >
            Add Option
          </Button>
          <Form.ErrorList errors={errors} />
        </Form.Item>
      </>
    );
  }

  if (!isNew && !setting) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <div style={{ marginTop: 20 }}>
      <Form
        {...layout}
        form={form}
        name="settings"
        autoComplete="off"
        onFinish={onFinish}
        initialValues={setting}
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
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Key"
          name="key"
          rules={[
            {
              required: true,
              message: 'Please enter a key',
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Tags"
          name="tags"
        >
          <TagsInput existingTags={existingTags} />
        </Form.Item>
        <Form.Item
          label="Type"
          name="settingType"
          rules={[
            {
              required: true,
              message: 'Please select a type',
            },
          ]}
        >
          <Select options={typeOptions} optionFilterProp="label" />
        </Form.Item>
        <Form.Item
          label="Description"
          name="description"
        >
          <TextArea autoSize={{ minRows: 3, maxRows: 14 }} />
        </Form.Item>
        {settingType === 'string' || settingType === 'number' ?
          <Form.Item
            label="Value"
            name="value"
          >
            <Input />
          </Form.Item>
          : null
        }
        {settingType === 'json' ?
          <Form.Item
            label="Value"
            name="value"
          >
            <JsonInput
              onError={(err) => { setError(err); }}
              theme={isDarkMode ? 'dark' : 'light'}
            />
          </Form.Item>
          : null
        }
        {settingType === 'options' ?
          <>
            <Form.Item
              label="Multiple"
              name="multiple"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.List name="options">
              {(fields, { add, move, remove }, { errors }) => (
                <OptionsList
                  fields={fields}
                  add={add}
                  move={move}
                  remove={remove}
                  errors={errors}
                />
              )}
            </Form.List>
          </>
          : null
        }
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