import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Table, message } from 'antd';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  deleteAppsAsync,
  getAppsAsync,
  selectLoading,
  selectApps,
} from './appsSlice';

import './AppsList.css';

export function AppsList() {

  const [page, setPage] = useLocalStorageState('apps-list-page', 1);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const apps = useSelector(selectApps);

  const data = useMemo(() => {
    const list = Object.values(apps).map((app) => ({
      key: app.id,
      name: app.name || 'undefined',
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [apps]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/apps-edit/new',
      title: 'Apps',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getAppsAsync({ workspaceId: selectedWorkspace.id }));
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
    console.log('selectedRowKeys:', selectedRowKeys);
    dispatch(deleteAppsAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      width: '100%',
      render: (_, { key, name }) => <Link to={`/apps/${key}`}>{name}</Link>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <div className="row-actions">
          <Space>
            <Button type="link"
              style={{ paddingLeft: 0 }}
              onClick={() => navigate(`/apps/${record.key}`)}
            >
              View
            </Button>
            <Button type="link"
              style={{ paddingLeft: 0 }}
              onClick={() => navigate(`/apps-edit/${record.key}`)}
            >
              Edit
            </Button>
          </Space>
        </div>
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
      <div id="appslist" style={{ marginTop: 20 }}>
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
