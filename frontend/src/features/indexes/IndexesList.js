import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { Button, Space, Table, Tag, message } from 'antd';

import NavbarContext from '../../context/NavbarContext';

import { SearchModal } from './SearchModal';
import {
  deleteIndexesAsync,
  getIndexesAsync,
  selectLoading,
  selectIndexes,
} from './indexesSlice';

export function IndexesList() {

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const indexes = useSelector(selectIndexes);

  const data = useMemo(() => {
    const list = Object.values(indexes).map((index) => ({
      key: index.id,
      name: index.name,
      engine: index.engine,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [indexes]);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);

  const dispatch = useDispatch();

  const location = useLocation();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/indexes/new',
      title: 'Indexes',
    }));
    dispatch(getIndexesAsync());
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
    dispatch(deleteIndexesAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const onSearchCancel = () => {
    setIsSearchModalOpen(false);
    setSelectedIndex('');
  };

  const openSearch = (index) => {
    setSelectedIndex(index);
    setIsSearchModalOpen(true);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/indexes/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Engine',
      dataIndex: 'engine',
      width: '100%',
      render: (_, { engine }) => (
        <Tag>{engine}</Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => openSearch(record.name)}
          >
            Search
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
      <SearchModal
        onCancel={onSearchCancel}
        open={isSearchModalOpen}
        indexName={selectedIndex}
        theme={isDarkMode ? 'dark' : 'light'}
      />
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
