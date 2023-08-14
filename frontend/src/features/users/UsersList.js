import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Table } from 'antd';

import NavbarContext from '../../contexts/NavbarContext';
import {
  getUsersAsync,
  selectLoading,
  selectUsers,
} from './usersSlice';

export function UsersList() {

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const users = useSelector(selectUsers);

  const data = useMemo(() => Object.values(users).map((u) => ({
    key: u.id,
    name: u.fullName,
    email: u.email,
  })), [users]);

  const dispatch = useDispatch();

  const { setNavbarState } = useContext(NavbarContext);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Users',
    }));
    dispatch(getUsersAsync());
  }, []);

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => <Link to={`/profile/${key}`}>{name}</Link>
    },
    {
      title: 'Email',
      dataIndex: 'email',
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
        <Button danger type="primary" onClick={() => { }} disabled={!hasSelected} loading={loading}>
          Todo
        </Button>
        <span style={{ marginLeft: 8 }}>
          {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
        </span>
      </div>
      <Table rowSelection={rowSelection} columns={columns} dataSource={data} />
    </div>
  );
};
