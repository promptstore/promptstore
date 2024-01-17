import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Modal, Space, Table, Tabs, message } from 'antd';
import useLocalStorageState from 'use-local-storage-state';
import { v4 as uuidv4 } from 'uuid';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  getDataSourcesAsync,
  getDataSourceContentAsync,
  selectDataSources,
  selectLoading as selectDataSourcesLoading,
} from '../dataSources/dataSourcesSlice';
import {
  getDestinationAsync,
  selectDestinations,
  selectLoading as selectDestinationsLoading,
} from '../destinations/destinationsSlice';
import {
  deleteTransformationsAsync,
  getTransformationsAsync,
  runTransformationAsync,
  selectTransformations,
  selectLoading,
} from './transformationsSlice';

export function TransformationsList() {

  const [correlationId, setCorrelationId] = useState({});
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [page, setPage] = useLocalStorageState('transformations-list-page', { defaultValue: 1 });
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const dataSources = useSelector(selectDataSources);
  const dataSourcesLoading = useSelector(selectDataSourcesLoading);
  const destinations = useSelector(selectDestinations);
  const destinationsLoading = useSelector(selectDestinationsLoading);
  const loading = useSelector(selectLoading);
  const transformations = useSelector(selectTransformations);

  const data = useMemo(() => {
    const list = Object.values(transformations).map((t) => ({
      key: t.id,
      name: t.name,
      dataSourceName: dataSources[t.dataSourceId]?.name,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [transformations, dataSources]);

  const content = useMemo(() => {
    if (selectedKey && dataSources) {
      const tx = transformations[selectedKey];
      const ds = dataSources[tx.dataSourceId];
      if (ds) {
        return ds.content;
      }
    }
    return null;
  }, [selectedKey, dataSources]);

  const destContent = useMemo(() => {
    if (selectedKey && destinations) {
      const tx = transformations[selectedKey];
      if (tx.destinationIds?.length) {
        const dest = destinations[tx.destinationIds[0]];
        if (dest) {
          return dest.content;
        }
      }
    }
    return null;
  }, [selectedKey, destinations]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/transformations/new',
      title: 'Transformations',
    }));
  }, []);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 3,
      });
    }
  }, [location]);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getDataSourcesAsync({ workspaceId }));
      dispatch(getTransformationsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    const tx = Object.values(transformations)
      .find(t => t.correlationId === correlationId[t.id]);
    if (tx) {
      setCorrelationId((curr) => ({ ...curr, [tx.id]: null }));
    }
  }, [correlationId, transformations]);

  useEffect(() => {
    if (selectedKey && !correlationId[selectedKey]) {
      messageApi.info({
        content: 'Transformation run complete',
        duration: 3,
      });
      setSelectedKey(null);
    }
  }, [correlationId, selectedKey]);

  const onPreviewCancel = () => {
    setIsPreviewModalOpen(false);
  }

  const onDelete = () => {
    dispatch(deleteTransformationsAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const openPreview = (key) => {
    const tx = transformations[key];
    if (tx.dataSourceId) {
      const ds = dataSources[tx.dataSourceId];
      if (!ds.content) {  // fetch once
        dispatch(getDataSourceContentAsync(tx.dataSourceId));
      }
    }
    if (tx.destinationIds?.length) {
      // fetch from first destination
      dispatch(getDestinationAsync(tx.destinationIds[0], true));
    }
    setSelectedKey(key);
    setIsPreviewModalOpen(true);
  };

  const runTransformation = (key) => {
    const correlationId = uuidv4();
    dispatch(runTransformationAsync({
      id: key,
      correlationId,
      workspaceId: selectedWorkspace.id,
    }));
    setCorrelationId((curr) => ({
      ...curr,
      [key]: correlationId,
    }));
    setSelectedKey(key);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/transformations/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Data Source',
      dataIndex: 'dataSourceName',
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 225,
      render: (_, record) => (
        <Space direction="vertical">
          <Space size="middle">
            <Button type="link"
              style={{ paddingLeft: 0 }}
              onClick={() => navigate(`/transformations/${record.key}`)}
            >
              Edit
            </Button>
            <Button type="link"
              style={{ paddingLeft: 0 }}
              onClick={() => openPreview(record.key)}
            >
              Preview
            </Button>
          </Space>
          <Button type="link"
            loading={!!correlationId[record.key]}
            style={{ paddingLeft: 0 }}
            onClick={() => runTransformation(record.key)}
          >
            Run
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [
      Table.SELECTION_ALL,
    ],
  };

  const hasSelected = selectedRowKeys.length > 0;

  function TableView({ data, loading }) {

    const columns = useMemo(() => {
      if (data && data.length) {
        return Object.keys(data[0]).map((k, i) => ({
          title: k,
          dataIndex: k,
          key: k,
        }));
      }
    }, [data]);

    const dataSource = useMemo(() => {
      if (data) {
        return data.map((row, i) => ({ ...row, key: i }));
      }
      return null;
    }, [data]);

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        pagination={false}
      />
    );
  }

  return (
    <>
      {contextHolder}
      <Modal
        open={isPreviewModalOpen}
        title="Content Preview"
        width={'75%'}
        bodyStyle={{ height: 500 }}
        onCancel={onPreviewCancel}
        okButtonProps={{ style: { display: 'none' } }}
      >
        <Tabs
          defaultActiveKey="src"
          items={[
            {
              key: 'src',
              label: 'Source',
              children: (
                <div style={{ height: 438, overflowY: 'auto' }}>
                  <TableView
                    data={content}
                    loading={dataSourcesLoading}
                  />
                </div>
              )
            },
            {
              key: 'dst',
              label: 'Destination',
              children: (
                <div style={{ height: 438, overflowY: 'auto' }}>
                  <TableView
                    data={destContent}
                    loading={destinationsLoading}
                  />
                </div>
              )
            },
          ]}
        />
      </Modal>
      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
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
          pagination={{
            current: page,
            onChange: (page, pageSize) => setPage(page),
          }}
        />
      </div>
    </>
  );
};
