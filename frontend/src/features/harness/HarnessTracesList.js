import { useContext, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Space, Switch, Table, Tag, message } from 'antd';
import { DeleteOutlined, RedoOutlined } from '@ant-design/icons';
import * as dayjs from 'dayjs';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  listHarnessTracesAsync,
  deleteHarnessTracesAsync,
  subscribeWorkspaceAsync,
  unsubscribeWorkspace,
  selectHarnessList,
  selectHarnessCount,
  selectHarnessLoading,
} from './harnessTracesSlice';

const AUTO_REFRESH_MS = 8000;

export function HarnessTracesList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const list = useSelector(selectHarnessList);
  const count = useSelector(selectHarnessCount);
  const loading = useSelector(selectHarnessLoading);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const workspaceId = selectedWorkspace && selectedWorkspace.id;

  useEffect(() => {
    setNavbarState(state => ({ ...state, createLink: null, title: 'Harness Traces' }));
  }, []);

  const fetchData = () => {
    if (workspaceId) {
      dispatch(listHarnessTracesAsync({ workspaceId, limit: pageSize, start: (page - 1) * pageSize }));
    }
  };

  useEffect(() => { fetchData(); }, [workspaceId, page, pageSize]);

  const handleBulkDelete = () => {
    const traceIds = [...selectedRowKeys];
    if (!workspaceId || traceIds.length === 0) return;
    Modal.confirm({
      title: `Delete ${traceIds.length} trace${traceIds.length === 1 ? '' : 's'}?`,
      content: 'This permanently removes the selected traces and all their spans. This cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        setDeleting(true);
        try {
          await dispatch(deleteHarnessTracesAsync({
            workspaceId, traceIds, limit: pageSize, start: (page - 1) * pageSize,
          }));
          setSelectedRowKeys([]);
          message.success(`Deleted ${traceIds.length} trace${traceIds.length === 1 ? '' : 's'}`);
        } catch (err) {
          message.error('Failed to delete traces');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const t = setInterval(fetchData, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [autoRefresh, workspaceId, page, pageSize]);

  // Live workspace feed: new/updated runs trigger a debounced refetch so rows
  // appear/animate without polling. Falls back to the auto-refresh toggle when
  // the stream is unavailable.
  const debounceRef = useRef(null);
  useEffect(() => {
    if (!workspaceId) return undefined;
    const onTouch = () => {
      if (debounceRef.current) return;
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        dispatch(listHarnessTracesAsync({ workspaceId, limit: pageSize, start: (page - 1) * pageSize }));
      }, 1000);
    };
    dispatch(subscribeWorkspaceAsync({ workspaceId, onTouch }));
    return () => {
      dispatch(unsubscribeWorkspace());
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    };
  }, [dispatch, workspaceId, page, pageSize]);

  const columns = [
    {
      title: 'Trace',
      dataIndex: 'name',
      render: (name, row) => (
        <a onClick={() => navigate(`/harness/${row.trace_id}`)}>{name || row.trace_id.slice(0, 12)}</a>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      // Three-state for conversations: an open hitl.pause => suspended on the
      // user; else an open span => actively working; else the final status.
      render: (status, row) => row.awaiting_user
        ? <Tag color="gold">awaiting user</Tag>
        : row.running
          ? <Tag color="processing">running</Tag>
          : <Tag color={status === 'error' ? 'red' : 'green'}>{status}</Tag>,
    },
    {
      title: 'Conversation',
      dataIndex: 'session_id',
      width: 140,
      render: (sid) => sid
        ? <Tag title={sid} style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sid}</Tag>
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    { title: 'Turns', dataIndex: 'turns', width: 80 },
    { title: 'Tools', dataIndex: 'tool_calls', width: 80 },
    {
      title: 'Tokens (in/out/cached)',
      width: 180,
      render: (_, r) => `${r.prompt_tokens}/${r.completion_tokens}/${r.cached_tokens}`,
    },
    {
      title: 'Cost',
      dataIndex: 'cost_total',
      width: 110,
      render: (c) => `$${Number(c || 0).toFixed(4)}`,
    },
    {
      title: 'Duration',
      dataIndex: 'duration_ms',
      width: 110,
      render: (d) => d == null ? '—' : <Tag color={d > 5000 ? 'orange' : 'default'}>{d} ms</Tag>,
    },
    {
      title: 'Started',
      dataIndex: 'start_time',
      width: 170,
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<RedoOutlined />} onClick={fetchData}>Refresh</Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={selectedRowKeys.length === 0}
          loading={deleting}
          onClick={handleBulkDelete}
        >
          Delete{selectedRowKeys.length ? ` (${selectedRowKeys.length})` : ''}
        </Button>
        <span>Auto-refresh <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} /></span>
      </Space>
      <Table
        rowKey="trace_id"
        loading={loading}
        columns={columns}
        dataSource={list}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        pagination={{
          current: page,
          pageSize,
          total: count,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); setSelectedRowKeys([]); },
        }}
      />
    </div>
  );
}
