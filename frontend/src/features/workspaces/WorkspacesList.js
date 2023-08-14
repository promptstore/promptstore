import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Table, message } from 'antd';
import { CheckCircleTwoTone } from '@ant-design/icons';
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
  const [page, setPage] = useLocalStorageState('workspaces-list-page', 1);
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
        duration: 3,
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
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const onSelectWorkspace = (id) => (ev) => {
    setSelectedWorkspace(workspaces[id]);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      width: '100%',
      render: (_, { key, name }) => <Link to={`/workspaces/${key}`}>{name}</Link>
    },
  ];

  if (currentUser?.roles?.includes('admin')) {
    columns.push(
      {
        title: 'Public',
        dataIndex: 'isPublic',
        width: '100%',
        render: (_, { isPublic }) => (
          <div style={{ fontSize: '1.5em', textAlign: 'center' }}>
            <span>{isPublic ? <CheckCircleTwoTone twoToneColor="#52c41a" /> : ''}</span>
          </div>
        )
      },
    );
  }

  columns.push(
    {
      title: 'Action',
      key: 'action',
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
