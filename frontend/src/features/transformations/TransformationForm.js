import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Col, Divider, Form, Input, Row, Select, Space } from 'antd';
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

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getDataSourcesAsync,
  getDataSourceContentAsync,
  selectDataSources,
  selectLoading as selectDataSourcesLoading,
} from '../dataSources/dataSourcesSlice';
import {
  getDestinationsAsync,
  selectDestinations,
  selectLoading as selectDestinationsLoading,
} from '../destinations/destinationsSlice';
import {
  getFunctionsAsync,
  selectFunctions,
} from '../functions/functionsSlice';
import {
  getIndexesAsync,
  selectIndexes,
  selectLoading as selectIndexesLoading,
  setIndexes,
} from '../indexes/indexesSlice';
import { engineOptions } from '../../options';

import {
  createTransformationAsync,
  getTransformationAsync,
  selectLoaded,
  selectTransformations,
  updateTransformationAsync,
} from './transformationsSlice';

const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const dataTypeOptions = ['Vector', 'String', 'Integer', 'Float', 'Boolean'].map(t => ({
  label: t,
  value: t,
}));

function Draghandle({ attributes, listeners }) {
  return (
    <button
      className="drag-handle"
      {...listeners}
      {...attributes}
    >
      <svg viewBox="0 0 20 20" width="12">
        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
      </svg>
    </button>
  );
}

function SortableItem({ field, index, remove, columnOptions, functionOptions }) {

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div key={field.key} ref={setNodeRef} style={style} className="table-row">
      <div className="table-col">
        <Draghandle attributes={attributes} listeners={listeners} />
      </div>
      <Form.Item
        name={[field.name, 'column']}
        className="table-col"
        style={{ width: '28%' }}
      >
        <Select allowClear showSearch
          options={columnOptions}
          optionFilterProp="label"
          placeholder="Select column"
        />
      </Form.Item>
      <Form.Item
        name={[field.name, 'dataType']}
        className="table-col"
        style={{ width: '16%' }}
      >
        <Select allowClear showSearch
          options={dataTypeOptions}
          optionFilterProp="label"
          placeholder="Select data type"
        />
      </Form.Item>
      <Form.Item
        name={[field.name, 'functionId']}
        className="table-col"
        style={{ width: '28%' }}
      >
        <Select allowClear showSearch
          options={functionOptions}
          optionFilterProp="children"
          placeholder="Search to select a function"
          filterOption={(input, option) => (option?.label ?? '').includes(input)}
          filterSort={(a, b) =>
            (a?.label ?? '').toLowerCase().localeCompare((b?.label ?? '').toLowerCase())
          }
        />
      </Form.Item>
      <Form.Item
        name={[field.name, 'name']}
        className="table-col"
        style={{ width: '28%' }}
      >
        <Input placeholder="Feature name" />
      </Form.Item>
      <div className="table-col">
        <Button type="text"
          icon={<CloseOutlined />}
          className="dynamic-delete-button"
          onClick={() => remove(field.name)}
        />
      </div>
    </div>
  );
}

export function TransformationForm() {

  const dataSources = useSelector(selectDataSources);
  const dataSourcesLoading = useSelector(selectDataSourcesLoading);
  const destinations = useSelector(selectDestinations);
  const destinationsLoading = useSelector(selectDestinationsLoading);
  const functions = useSelector(selectFunctions);
  const indexes = useSelector(selectIndexes);
  const indexesLoading = useSelector(selectIndexesLoading);
  const loaded = useSelector(selectLoaded);
  const [newIndex, setNewIndex] = useState('');
  const transformations = useSelector(selectTransformations);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const newIndexInputRef = useRef(null);
  const [form] = Form.useForm();
  const dataSourceIdValue = Form.useWatch('dataSourceId', form);
  const indexValue = Form.useWatch('indexId', form);

  const id = location.pathname.match(/\/transformations\/(.*)/)[1];
  const transformation = transformations[id];
  const isNew = id === 'new';

  const columnOptions = useMemo(() => {
    if (dataSourceIdValue && dataSources) {
      const ds = dataSources[dataSourceIdValue];
      if (ds && ds.content && ds.content.length) {
        const list = Object
          .keys(ds.content[0])
          .map(col => ({
            label: col,
            value: col,
          }));
        list.sort((a, b) => a.label < b.label ? -1 : 1);
        return [
          {
            label: '** all **',
            value: '__all',
          },
          ...list
        ];
      }
    }
    return null;
  }, [dataSourceIdValue, dataSources]);

  const dataSourceOptions = useMemo(() => {
    const list = Object.values(dataSources).map((d) => ({
      label: d.name,
      value: d.id,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [dataSources]);

  const destinationOptions = useMemo(() => {
    const list = Object.values(destinations).map((d) => ({
      label: d.name,
      value: d.id,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [destinations]);

  const functionOptions = useMemo(() => {
    const list = Object.values(functions).map((func) => ({
      label: func.name,
      value: func.id,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return [
      {
        label: '** pass through **',
        value: '__pass',
      },
      ...list
    ];
  }, [functions]);

  const indexOptions = useMemo(() => {
    const list = Object.values(indexes)
      .map((index) => ({
        label: index.name,
        value: index.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [indexes]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Transformation',
    }));
    if (!isNew) {
      dispatch(getTransformationAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getFunctionsAsync({ workspaceId }));
      dispatch(getDestinationsAsync({ workspaceId }));
      dispatch(getIndexesAsync({ workspaceId }));
      dispatch(getDataSourcesAsync({ type: 'sql', workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (dataSourceIdValue && dataSources) {
      const ds = dataSources[dataSourceIdValue];
      if (ds && !ds.content) {
        dispatch(getDataSourceContentAsync(dataSourceIdValue));
      }
    }
  }, [dataSourceIdValue, dataSources]);

  const createNewIndex = (ev) => {
    ev.preventDefault();
    if (newIndex) {
      dispatch(setIndexes({
        indexes: [{ id: 'new', name: newIndex }],
      }));
    }
    setTimeout(() => {
      newIndexInputRef.current?.focus();
    }, 0);
  };

  const onCancel = () => {
    navigate('/transformations');
  };

  const onFinish = (values) => {
    if (isNew) {
      dispatch(createTransformationAsync({
        values: {
          ...values,
          indexName: newIndex,
          workspaceId: selectedWorkspace.id,
        },
      }));
    } else {
      dispatch(updateTransformationAsync({
        id,
        values: {
          ...transformation,
          ...values,
        },
      }));
    }
    navigate('/transformations');
  };

  const onNewIndexChange = (ev) => {
    setNewIndex(ev.target.value);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function FeatureList({ fields, errors, add, move, remove }) {

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
            <div className="table">
              {fields.map((field, index) => (
                <SortableItem key={field.key}
                  field={field}
                  index={index}
                  remove={remove}
                  columnOptions={columnOptions}
                  functionOptions={functionOptions}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <SortableItem
                field={fields.find(f => f.key === activeId)}
                index={fields.findIndex(f => f.key === activeId)}
                remove={remove}
                columnOptions={columnOptions}
                functionOptions={functionOptions}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
        <Form.Item wrapperCol={{ span: 24 }}>
          <Button
            type="dashed"
            onClick={() => add()}
            style={{ width: '100%', zIndex: 101 }}
            icon={<PlusOutlined />}
          >
            Add Feature
          </Button>
          <Form.ErrorList errors={errors} />
        </Form.Item>
      </>
    );
  }

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
        name="transformation"
        autoComplete="off"
        onFinish={onFinish}
        initialValues={transformation}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            {
              required: true,
              message: 'Please enter a transformation name',
            },
          ]}
          wrapperCol={{ span: 14 }}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Description"
          name="description"
          wrapperCol={{ span: 14 }}
        >
          <TextArea autoSize={{ minRows: 3, maxRows: 14 }} />
        </Form.Item>
        <Form.Item
          label="Data Source"
          name="dataSourceId"
          rules={[
            {
              required: true,
              message: 'Please select the data source',
            },
          ]}
          wrapperCol={{ span: 14 }}
        >
          <Select allowClear showSearch
            loading={dataSourcesLoading}
            optionFilterProp="children"
            options={dataSourceOptions}
            placeholder="Search to select a data source"
            filterOption={(input, option) => (option?.label ?? '').includes(input)}
            filterSort={(a, b) =>
              (a?.label ?? '').toLowerCase().localeCompare((b?.label ?? '').toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item
          label="Destinations"
          name="destinationIds"
          wrapperCol={{ span: 14 }}
        >
          <Select allowClear showSearch
            loading={destinationsLoading}
            mode="multiple"
            options={destinationOptions}
            optionFilterProp="children"
            placeholder="Search to select a destination"
            filterOption={(input, option) => (option?.label ?? '').includes(input)}
            filterSort={(a, b) =>
              (a?.label ?? '').toLowerCase().localeCompare((b?.label ?? '').toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item
          label="Index"
          name="indexId"
          wrapperCol={{ span: 14 }}
        >
          <Select allowClear showSearch
            loading={indexesLoading}
            options={indexOptions}
            optionFilterProp="children"
            placeholder="Search to select an index"
            filterOption={(input, option) => (option?.label ?? '').includes(input)}
            filterSort={(a, b) =>
              (a?.label ?? '').toLowerCase().localeCompare((b?.label ?? '').toLowerCase())
            }
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Space style={{ padding: '0 8px 4px' }}>
                  <Input
                    placeholder="Enter new index name"
                    ref={newIndexInputRef}
                    value={newIndex}
                    onChange={onNewIndexChange}
                  />
                  <Button type="text" icon={<PlusOutlined />} onClick={createNewIndex}>
                    Create New Index
                  </Button>
                </Space>
              </>
            )}
          />
        </Form.Item>
        {indexValue === 'new' ?
          <Form.Item
            label="Index Engine"
            name="engine"
            rules={[
              {
                required: true,
                message: 'Please select the engine',
              },
            ]}
            wrapperCol={{ span: 14 }}
          >
            <Select options={engineOptions} optionFilterProp="label" />
          </Form.Item>
          : null
        }
        {dataSourceIdValue ?
          <Form.Item wrapperCol={{ offset: 4, span: 14 }}>
            <Divider orientation="left" plain style={{ height: 32 }}>
              Features
            </Divider>
            <div style={{ display: 'flex' }}>
              <div style={{ flex: 1, padding: '0 12px 5px' }}>Source column</div>
              <div style={{ flex: 1, marginLeft: 8, padding: '0 12px 5px' }}>Data Type</div>
              <div style={{ flex: 1, marginLeft: 8, padding: '0 12px 5px' }}>Function</div>
              <div style={{ flex: 1, marginLeft: 8, padding: '0 12px 5px' }}>Name</div>
              <div style={{ width: 32 }}></div>
            </div>
            <Form.List name="features">
              {(fields, { add, move, remove }, { errors }) => (
                <FeatureList
                  fields={fields}
                  add={add}
                  move={move}
                  remove={remove}
                  errors={errors}
                />
              )}
            </Form.List>
          </Form.Item>
          : null
        }
        <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
          <Space>
            <Button type="default" onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
