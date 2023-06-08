import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { Button, Space, Table, message } from 'antd';

import NavbarContext from '../../context/NavbarContext';
import {
  deleteCompositionsAsync,
  getCompositionsAsync,
  selectLoading,
  selectCompositions,
} from './compositionsSlice';

export function CompositionsList() {

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const compositions = useSelector(selectCompositions);
  const loading = useSelector(selectLoading);

  const data = useMemo(() => {
    const list = Object.values(compositions).map((comp) => ({
      key: comp.id,
      name: comp.name,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [compositions]);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);

  const dispatch = useDispatch();

  const location = useLocation();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/compositions/new',
      title: 'Compositions',
    }));
    dispatch(getCompositionsAsync());
  }, []);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 3,
      });
    }
  }, [location]);

  const onDelete = () => {
    dispatch(deleteCompositionsAsync({ ids: selectedRowKeys }));
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
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/compositions/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
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
        <Table rowSelection={rowSelection} columns={columns} dataSource={data} loading={loading} />
      </div>
    </>
  );
};
