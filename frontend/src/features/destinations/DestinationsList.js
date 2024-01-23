import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Table, Tag, message } from 'antd';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { getColor } from '../../utils';

import {
  deleteDestinationsAsync,
  getDestinationsAsync,
  selectDestinations,
  selectLoading,
} from './destinationsSlice';

export function DestinationsList() {

  const [page, setPage] = useLocalStorageState('destinations-list-page', { defaultValue: 1 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const destinations = useSelector(selectDestinations);
  const loading = useSelector(selectLoading);

  const data = useMemo(() => {
    const list = Object.values(destinations).map((dst) => ({
      key: dst.id,
      name: dst.name,
      type: dst.type,
      instance: dst.documentType || dst.dialect,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [destinations]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/destinations/new',
      title: 'Destinations',
    }));
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
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getDestinationsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  const onDelete = () => {
    dispatch(deleteDestinationsAsync({ ids: selectedRowKeys }));
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
          <Link to={`/destinations/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Source Type',
      dataIndex: 'type',
      render: (_, { type }) => (
        <Tag>{type}</Tag>
      )
    },
    {
      title: 'Instance Type',
      dataIndex: 'instance',
      render: (_, { instance }) => (
        <Tag color={getColor(instance)}>{instance}</Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 225,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/destinations/${record.key}`)}
          >
            Edit
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
