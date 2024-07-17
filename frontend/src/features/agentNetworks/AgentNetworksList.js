import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Modal, Space, Table, Typography } from 'antd';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import usePrevious from '../../hooks/usePrevious';

import {
  deleteAgentNetworksAsync,
  getAgentNetworksAsync,
  runAgentNetworkAsync,
  selectAgentNetworks,
  selectLoading,
  selectResult,
  selectRunning,
} from './agentNetworksSlice';

export function AgentNetworksList() {

  const [page, setPage] = useLocalStorageState('agent-networks-list-page', { defaultValue: 1 });
  const [selectedResultKey, setSelectedResultKey] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const agentNetworks = useSelector(selectAgentNetworks);
  const loading = useSelector(selectLoading);
  const result = useSelector(selectResult);
  const running = useSelector(selectRunning);

  const data = useMemo(() => {
    const list = Object.values(agentNetworks).map(r => ({
      key: r.id,
      name: r.name,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [agentNetworks]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const previous = usePrevious({ running });

  useEffect(() => {
    const keys = Object.entries(running).reduce((a, [k, v]) => {
      if (v) a.push(k);
      return a;
    }, []);
    const prevKeys = Object.entries(previous?.running || {}).reduce((a, [k, v]) => {
      if (v) a.push(k);
      return a;
    }, []);
    for (const key of prevKeys) {
      if (!keys.includes(key)) {
        setSelectedResultKey(key);
        break;
      }
    }
  }, [running]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/agent-networks/new',
      title: 'Agent Networks',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getAgentNetworksAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  const handleModalCancel = () => {
    setSelectedResultKey(null);
  };

  const handleRun = (agentNetworkId) => {
    dispatch(runAgentNetworkAsync({ agentNetworkId }));
  };

  const onDelete = () => {
    dispatch(deleteAgentNetworksAsync({ ids: selectedRowKeys }));
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
          <Link to={`/agent-networks/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 225,
      render: (_, record) => (
        <Space wrap>
          <Button type="link"
            onClick={() => navigate(`/agent-networks/${record.key}`)}
            style={{ paddingLeft: 0 }}
          >
            Edit
          </Button>
          <Button type="link"
            loading={running[record.key]}
            onClick={() => handleRun(record.key)}
            style={{ paddingLeft: 0 }}
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

  return (
    <>
      <Modal
        cancelText="Close"
        okButtonProps={{ style: { display: 'none' } }}
        onCancel={handleModalCancel}
        open={selectedResultKey}
        title="Results"
      >
        <Typography.Paragraph>{JSON.stringify(result[selectedResultKey])}</Typography.Paragraph>
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

}