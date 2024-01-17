import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Space, Table } from 'antd';

import NavbarContext from '../../contexts/NavbarContext';
import { formatNumber } from '../../utils';
import {
  deleteUsersAsync,
  getUsersAsync,
  selectLoading,
  selectUsers,
} from './usersSlice';

export function UsersList() {

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const users = useSelector(selectUsers);

  const data = useMemo(() => {
    const list = Object.values(users).map((u) => ({
      key: u.id,
      name: u.fullName,
      email: u.email,
      credits: u.credits,
      lastName: u.lastName,
    }));
    list.sort((a, b) => a.lastName < b.lastName ? -1 : 1);
    return list;
  }, [users]);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { setNavbarState } = useContext(NavbarContext);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Users',
    }));
    dispatch(getUsersAsync());
  }, []);

  const onDelete = () => {
    dispatch(deleteUsersAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => <Link to={`/users/${key}`}>{name}</Link>
    },
    {
      title: 'Email',
      dataIndex: 'email',
    },
    {
      title: 'Credits',
      dataIndex: 'credits',
      align: 'right',
      render: (_, { credits }) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {formatNumber(credits)}
        </div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 250,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/users/${record.key}`)}
          >
            View
          </Button>
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/users/${record.key}/edit`)}
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
    <div style={{ marginTop: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <Button danger type="primary" onClick={onDelete} disabled={!hasSelected} loading={loading}>
          Delete
        </Button>
        <span style={{ marginLeft: 8 }}>
          {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
        </span>
      </div>
      <Table rowSelection={rowSelection} columns={columns} dataSource={data} />
    </div>
  );
};
