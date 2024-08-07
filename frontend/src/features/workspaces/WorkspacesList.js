import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Table, Typography, message } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../contexts/NavbarContext';
import UserContext from '../../contexts/UserContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  deleteWorkspacesAsync,
  getWorkspacesAsync,
  selectLoading,
  selectWorkspaces,
} from './workspacesSlice';

export function WorkspacesList() {

  const [isLinking, setIsLinking] = useState(false);
  const [page, setPage] = useLocalStorageState('workspaces-list-page', { defaultValue: 1 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const workspaces = useSelector(selectWorkspaces);

  const data = useMemo(() => {
    const list = Object.values(workspaces).map((ws) => ({
      key: ws.id,
      name: ws.name,
      isPublic: ws.isPublic,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [workspaces]);

  const { setNavbarState } = useContext(NavbarContext);
  const { currentUser } = useContext(UserContext);
  const { selectedWorkspace, setSelectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/workspaces/new',
      title: 'Workspaces',
    }));
    dispatch(getWorkspacesAsync());
  }, []);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 5,
      });
    }
  }, [location]);

  useEffect(() => {
    if (selectedWorkspace && isLinking) {
      setIsLinking(false);
      navigate('/apps');
    }
  }, [selectedWorkspace, isLinking]);

  const linkToApps = (id) => (ev) => {
    setSelectedWorkspace(workspaces[id]);
    setIsLinking(true);
  };

  const onDelete = () => {
    dispatch(deleteWorkspacesAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
    if (selectedRowKeys.includes(selectedWorkspace.id)) {
      setSelectedWorkspace(null);
      setTimeout(() => {
        window.location.reload();
      }, 20);
    }
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const onSelectWorkspace = (id) => (ev) => {
    setSelectedWorkspace(workspaces[id]);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'key',
      render: (_, { key }) => (
        <div style={{ width: 65 }}>
          <Typography.Text code copyable>
            {key}
          </Typography.Text>
        </div>
      ),
      width: 100,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/workspaces/${key}`}>{name}</Link>
        </div>
      ),
    },
  ];

  if (currentUser?.roles?.includes('admin')) {
    columns.push(
      {
        title: 'Public',
        dataIndex: 'isPublic',
        align: 'center',
        render: (_, { isPublic }) => (
          <div style={{ fontSize: '1.5em' }}>
            <span>{isPublic ? <CheckOutlined /> : ''}</span>
          </div>
        )
      },
    );
  }

  columns.push(
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 225,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={linkToApps(record.key)}
          >
            Apps
          </Button>
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={onSelectWorkspace(record.key)}
          >
            Select
          </Button>
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/workspaces/${record.key}`)}
          >
            Edit
          </Button>
        </Space>
      ),
    },
  );

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
