import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Divider, Form, Input, Select, Space } from 'antd';
import { CloseOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
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
import * as dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { ScheduleModalInput } from '../../components/ScheduleModalInput';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getDataSourcesAsync,
  getDataSourceContentAsync,
  getDataSourceAsync,
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
// import {
//   getEmbeddingProvidersAsync,
//   selectEmbeddingProviders,
//   selectLoading as selectEmbeddingProvidersLoading,
// } from '../uploader/embeddingSlice';
import {
  getModelsAsync,
  selectModels,
  selectLoading as selectModelsLoading,
} from '../models/modelsSlice';
import {
  getGraphStoresAsync,
  selectGraphStores,
  selectLoaded as selectGraphStoresLoaded,
  selectLoading as selectGraphStoresLoading,
} from '../uploader/graphStoresSlice';
import {
  getVectorStoresAsync,
  selectVectorStores,
  selectLoaded as selectVectorStoresLoaded,
  selectLoading as selectVectorStoresLoading,
} from '../uploader/vectorStoresSlice';

import {
  createTransformationAsync,
  getTransformationAsync,
  selectLoaded,
  selectTransformations,
  updateTransformationAsync,
  pauseScheduleAsync,
  unpauseScheduleAsync,
  deleteScheduleAsync,
} from './transformationsSlice';

dayjs.extend(customParseFormat);

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
        className="table-col"
        name={[field.name, 'column']}
      >
        <Select allowClear showSearch
          options={columnOptions}
          optionFilterProp="label"
          placeholder="Select column"
        />
      </Form.Item>
      <Form.Item
        className="table-col"
        name={[field.name, 'dataType']}
      >
        <Select allowClear showSearch
          options={dataTypeOptions}
          optionFilterProp="label"
          placeholder="Select data type"
        />
      </Form.Item>
      <Form.Item
        className="table-col"
        name={[field.name, 'functionId']}
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
        className="table-col"
        name={[field.name, 'name']}
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

  const [backOnSave, setBackOnSave] = useState(false);
  const [newIndex, setNewIndex] = useState('');

  const dataSources = useSelector(selectDataSources);
  const dataSourcesLoading = useSelector(selectDataSourcesLoading);
  const destinations = useSelector(selectDestinations);
  const destinationsLoading = useSelector(selectDestinationsLoading);
  const functions = useSelector(selectFunctions);
  const graphStoresLoaded = useSelector(selectGraphStoresLoaded);
  const graphStoresLoading = useSelector(selectGraphStoresLoading);
  const graphStores = useSelector(selectGraphStores);
  const indexes = useSelector(selectIndexes);
  const indexesLoading = useSelector(selectIndexesLoading);
  const loaded = useSelector(selectLoaded);
  const models = useSelector(selectModels);
  const modelsLoading = useSelector(selectModelsLoading);
  const transformations = useSelector(selectTransformations);
  const vectorStoresLoaded = useSelector(selectVectorStoresLoaded);
  const vectorStoresLoading = useSelector(selectVectorStoresLoading);
  const vectorStores = useSelector(selectVectorStores);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const newIndexInputRef = useRef(null);
  const [form] = Form.useForm();
  const dataSourceIdValue = Form.useWatch('dataSourceId', form);
  const destinationIdsValue = Form.useWatch('destinationIds', form);
  const indexValue = Form.useWatch('indexId', form);

  // console.log('source:', dataSources[dataSourceIdValue]);

  const id = location.pathname.match(/\/transformations\/(.*)/)[1];
  const isNew = id === 'new';

  const transformation = useMemo(() => {
    const tx = transformations[id];
    if (tx) {
      const schedule = tx.schedule || {};
      return {
        ...tx,
        schedule: {
          ...schedule,
          startDate: schedule.startDate ? dayjs(schedule.startDate) : undefined,
          endDate: schedule.endDate ? dayjs(schedule.endDate) : undefined,
          startTime: schedule.startTime ? dayjs(schedule.startTime, 'HH:mm:ss') : undefined,
          endTime: schedule.endTime ? dayjs(schedule.endTime, 'HH:mm:ss') : undefined,
        },
      };
    }
    return null;
  }, [transformations]);

  // console.log('transformation:', transformation);

  const columnOptions = useMemo(() => {
    if (dataSourceIdValue && dataSources) {
      const ds = dataSources[dataSourceIdValue];
      // if (ds?.content?.length) {
      if (ds?.schema) {
        // const list = Object
        //   .keys(ds.content[0])
        //   .map(col => ({
        //     label: col,
        //     value: col,
        //   }));
        const list = Object
          .keys(ds.schema[ds.tables]?.properties || {})
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

  // const embeddingProviderOptions = useMemo(() => {
  //   const list = embeddingProviders.map(p => ({
  //     label: p.name,
  //     value: p.key,
  //   }));
  //   list.sort((a, b) => a.label < b.label ? -1 : 1);
  //   return list;
  // }, [embeddingProviders]);

  const embeddingModelOptions = useMemo(() => {
    const list = Object.values(models)
      .filter(m => m.type === 'embedding')
      .map(m => ({
        label: m.name,
        value: m.key,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [models]);

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

  const graphStoreOptions = useMemo(() => {
    const list = graphStores.map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [graphStores]);

  const indexOptions = useMemo(() => {
    const list = Object.values(indexes)
      .map((index) => ({
        label: index.name,
        value: index.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [indexes]);

  const vectorStoreOptions = useMemo(() => {
    const list = vectorStores.map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [vectorStores]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Transformation',
    }));
    if (!isNew) {
      dispatch(getTransformationAsync(id));
    }
    if (!graphStoresLoaded) {
      dispatch(getGraphStoresAsync());
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
      if (ds && !ds.schema) {
        dispatch(getDataSourceAsync(dataSourceIdValue));
      }
      // if (ds && !ds.content) {
      //   dispatch(getDataSourceContentAsync(dataSourceIdValue));
      // }
    }
  }, [dataSourceIdValue, dataSources]);

  useEffect(() => {
    if (indexValue === 'new' && !vectorStoresLoaded) {
      dispatch(getVectorStoresAsync());
      // dispatch(getEmbeddingProvidersAsync());
      dispatch(getModelsAsync({ workspaceId: selectedWorkspace.id, type: 'embedding' }));
    }
  }, [indexValue]);

  useEffect(() => {
    if (backOnSave) {
      setBackOnSave(false);
      navigate('/transformations');
    }
  }, [transformations]);

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
    let features;
    let schedule;
    // only save feature rows with values
    if (values.features) {
      features = values.features.filter(f => f && Object.values(f).some(v => v));
    }
    if (values.schedule) {
      schedule = {
        ...values.schedule,
        startDate: values.schedule.startDate?.format('YYYY-MM-DD'),
        endDate: values.schedule.endDate?.format('YYYY-MM-DD'),
        startTime: values.schedule.startTime?.format('HH:mm:ss'),
        endTime: values.schedule.endTime?.format('HH:mm:ss'),
      };
    }
    if (isNew) {
      dispatch(createTransformationAsync({
        values: {
          ...values,
          features,
          schedule,
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
          features,
          schedule,
          indexName: newIndex,
        },
      }));
    }
    setBackOnSave(true);
  };

  const onNewIndexChange = (ev) => {
    setNewIndex(ev.target.value);
  };

  const pauseSchedule = () => {
    console.log('pausing schedule:', transformation.scheduleId);
    if (transformation.scheduleId) {
      dispatch(pauseScheduleAsync({ scheduleId: transformation.scheduleId }));
      dispatch(updateTransformationAsync({
        id,
        values: {
          ...transformation,
          scheduleStatus: 'paused',
        },
      }));
    }
  };

  const unpauseSchedule = () => {
    console.log('unpausing schedule:', transformation.scheduleId);
    if (transformation.scheduleId) {
      dispatch(unpauseScheduleAsync({ scheduleId: transformation.scheduleId }));
      dispatch(updateTransformationAsync({
        id,
        values: {
          ...transformation,
          scheduleStatus: 'running',
        },
      }));
    }
  };

  const deleteSchedule = () => {
    console.log('deleting schedule:', transformation.scheduleId);
    if (transformation.scheduleId) {
      dispatch(deleteScheduleAsync({ scheduleId: transformation.scheduleId }));
      dispatch(updateTransformationAsync({
        id,
        values: {
          ...transformation,
          schedule: null,
          scheduleId: null,
          scheduleStatus: null,
        },
      }));
    }
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
              <div className="table-row">
                <div className="table-col"></div>
                <div className="table-col">Source column</div>
                <div className="table-col">Data Type</div>
                <div className="table-col">Function</div>
                <div className="table-col">Name</div>
                <div className="table-col"></div>
              </div>
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
        <Form.Item wrapperCol={{ offset: 4, span: 14 }} style={{ marginBottom: 16 }}>
          <Divider orientation="left" plain style={{ fontWeight: 600, margin: 0 }}>
            Input
          </Divider>
        </Form.Item>
        <Form.Item
          label="Data Source"
          wrapperCol={{ span: 14 }}
        >
          <Form.Item
            name="dataSourceId"
            rules={[
              {
                required: true,
                message: 'Please select the data source',
              },
            ]}
            style={{
              display: 'inline-block',
              marginBottom: 0,
              width: 'calc(100% - 32px)',
            }}
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
          <Button
            disabled={!dataSourceIdValue}
            type="link"
            icon={<LinkOutlined />}
            onClick={() => navigate(`/data-sources/${dataSourceIdValue}`)}
            style={{ width: 32 }}
          />
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 4, span: 14 }} style={{ marginBottom: 16 }}>
          <Divider orientation="left" plain style={{ fontWeight: 600, margin: 0 }}>
            Outputs
          </Divider>
        </Form.Item>
        <Form.Item
          label="Destinations"
          wrapperCol={{ span: 14 }}
        >
          <Form.Item
            name="destinationIds"
            style={{
              display: 'inline-block',
              marginBottom: 0,
              width: 'calc(100% - 32px)',
            }}
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
          <Button
            disabled={!destinationIdsValue?.length}
            type="link"
            icon={<LinkOutlined />}
            onClick={() => navigate(`/destinations/${destinationIdsValue[0]}`)}
            style={{ width: 32 }}
          />
        </Form.Item>
        <Form.Item
          label="Index"
          wrapperCol={{ span: 14 }}
        >
          <Form.Item
            name="indexId"
            style={{
              display: 'inline-block',
              marginBottom: 0,
              width: 'calc(100% - 32px)',
            }}
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
          <Button
            disabled={!indexValue}
            type="link"
            icon={<LinkOutlined />}
            onClick={() => navigate(`/indexes/${indexValue}`)}
            style={{ width: 32 }}
          />
        </Form.Item>
        {indexValue === 'new' ?
          <>
            <Form.Item
              label="Vector Store"
              wrapperCol={{ span: 14 }}
            >
              <Form.Item
                name="vectorStoreProvider"
                rules={[
                  {
                    required: true,
                    message: 'Please select the vector store',
                  },
                ]}
                style={{
                  display: 'inline-block',
                  marginBottom: 0,
                  width: 'calc(100% - 32px)',
                }}
              >
                <Select
                  allowClear
                  loading={vectorStoresLoading}
                  options={vectorStoreOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
            </Form.Item>
            <Form.Item
              label="Embedding"
              wrapperCol={{ span: 14 }}
            >
              <Form.Item
                name="embeddingModel"
                rules={[
                  {
                    required: true,
                    message: 'Please select the embedding model',
                  },
                ]}
                style={{
                  display: 'inline-block',
                  marginBottom: 0,
                  width: 'calc(100% - 32px)',
                }}
              >
                <Select
                  allowClear
                  loading={modelsLoading}
                  options={embeddingModelOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
            </Form.Item>
          </>
          : null
        }
        <Form.Item
          label="Knowledge Graph"
          wrapperCol={{ span: 14 }}
        >
          <Form.Item
            name="graphStoreProvider"
            style={{
              display: 'inline-block',
              marginBottom: 0,
              width: 'calc(100% - 32px)',
            }}
          >
            <Select
              allowClear
              loading={graphStoresLoading}
              options={graphStoreOptions}
              optionFilterProp="label"
            />
          </Form.Item>
        </Form.Item>
        <Form.Item
          label="Schedule"
          name="schedule"
        >
          <ScheduleModalInput
            onPause={pauseSchedule}
            onUnpause={unpauseSchedule}
            onDelete={deleteSchedule}
            scheduleId={transformation?.scheduleId}
            scheduleStatus={transformation?.scheduleStatus}
          />
        </Form.Item>
        {dataSourceIdValue ?
          <>
            <Form.Item wrapperCol={{ offset: 4, span: 14 }} style={{ marginBottom: 16 }}>
              <Divider orientation="left" plain style={{ fontWeight: 600, margin: 0 }}>
                Features
              </Divider>
            </Form.Item>
            <Form.Item wrapperCol={{ offset: 4, span: 14 }}>
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
          </>
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
