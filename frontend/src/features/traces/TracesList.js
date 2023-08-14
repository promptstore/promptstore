import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Table, Tag, message } from 'antd';
import useLocalStorageState from 'use-local-storage-state';
import * as dayjs from 'dayjs';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  deleteTracesAsync,
  getTracesAsync,
  selectTraces,
  selectLoading,
} from './tracesSlice';

const TIME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

export function TracesList() {

  const [page, setPage] = useLocalStorageState('traces-list-page', 1);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const traces = useSelector(selectTraces);
  const loading = useSelector(selectLoading);

  const data = useMemo(() => {
    const list = Object.values(traces).map((trace) => ({
      key: trace.id,
      name: trace.name,
      traceType: trace.traceType,
      created: trace.created,
    }));
    list.sort((a, b) => a.created > b.created ? -1 : 1);
    return list;
  }, [traces]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Traces',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getTracesAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 3,
      });
    }
  }, [location]);

  const onDelete = () => {
    dispatch(deleteTracesAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/traces/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Trace Type',
      dataIndex: 'traceType',
      render: (_, { traceType }) => (
        <Tag>{traceType}</Tag>
      )
    },
    {
      title: 'Run',
      dataIndex: 'runDatetime',
      // width: '100%',
      render: (_, { created }) => (
        <span>{dayjs(created).format(TIME_FORMAT)}</span>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/traces/${record.key}`)}
          >
            View
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

  return (
    <>
      {contextHolder}
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
