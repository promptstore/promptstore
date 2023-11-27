import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Table, Tag, message } from 'antd';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  DownloadOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import useLocalStorageState from 'use-local-storage-state';
import * as dayjs from 'dayjs';

import Download from '../../components/Download';
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

  const [page, setPage] = useLocalStorageState('traces-list-page', { defaultValue: 1 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const traces = useSelector(selectTraces);
  const loading = useSelector(selectLoading);

  const data = useMemo(() => {
    const list = Object.values(traces).map((trace) => ({
      key: trace.id,
      name: trace.name,
      traceType: trace.traceType,
      created: trace.created,
      success: trace.trace[0].success,
      latency: trace.trace[0].elapsedMillis,
      tokens: trace.trace[0].response?.usage?.total_tokens,
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
      onRefresh();
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

  const onRefresh = () => {
    const workspaceId = selectedWorkspace.id;
    dispatch(getTracesAsync({ workspaceId }));
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
      title: 'Type',
      dataIndex: 'traceType',
      render: (_, { traceType }) => (
        <Tag>{traceType}</Tag>
      )
    },
    {
      title: 'Run',
      dataIndex: 'runDatetime',
      render: (_, { created }) => (
        <span>{dayjs(created).format(TIME_FORMAT)}</span>
      )
    },
    {
      title: 'Success',
      dataIndex: 'success',
      render: (_, { success }) =>
        success ? (
          <div className="success">
            <CheckCircleFilled />
          </div>
        ) : (
          <div className="failure">
            <CloseCircleFilled />
          </div>
        )
    },
    {
      title: 'Latency',
      dataIndex: 'latency',
      render: (_, { latency }) => {
        if (latency && latency > 0) {
          const secs = latency / 1000;
          const color = secs > 5 ? 'red' : 'green';
          return (
            <Tag
              icon={<ClockCircleOutlined />}
              color={color}
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              {secs.toLocaleString('en-US')}s
            </Tag>
          );
        }
        return null;
      }
    },
    {
      title: 'Tokens',
      dataIndex: 'tokens',
      render: (_, { tokens }) => (
        <span>{tokens?.toLocaleString('en-US')}</span>
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

  const selectedTraces = selectedRowKeys.map(id => traces[id]);

  return (
    <>
      {contextHolder}
      <div style={{ marginTop: 20 }}>
        <Space style={{ marginBottom: 16 }}>
          <div>
            <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
              Delete
            </Button>
            <span style={{ marginLeft: 8 }}>
              {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
            </span>
          </div>
          <Button type="text" onClick={onRefresh} icon={<RedoOutlined />} />
          <Download filename={'traces.json'} payload={selectedTraces}>
            <Button type="text" icon={<DownloadOutlined />} />
          </Download>
        </Space>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            onChange: (page) => setPage(page),
          }}
        />
      </div>
    </>
  );
};
