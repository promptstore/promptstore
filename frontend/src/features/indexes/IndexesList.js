import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Table, Tag, message } from 'antd';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import { SearchModal } from '../../components/SearchModal';
import {
  deleteIndexesAsync,
  getIndexesAsync,
  selectLoading,
  selectIndexes,
} from './indexesSlice';

export function IndexesList() {

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [page, setPage] = useLocalStorageState('indexes-list-page', { defaultValue: 1 });
  const [selectedIndex, setSelectedIndex] = useState({});
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const indexes = useSelector(selectIndexes);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const isGraphList = !!location.pathname.match(/\/graphs\/?/);

  const data = useMemo(() => {
    const list = Object.values(indexes)
      .filter((index) => {
        if (isGraphList) {
          return !index.vectorStoreProvider;
        }
        return !!index.vectorStoreProvider;
      })
      .map((index) => ({
        key: index.id,
        name: index.name,
        nodeLabel: index.nodeLabel,
        storeType: index.vectorStoreProvider ? 'Vector' : 'Graph',
        store: index.vectorStoreProvider || index.graphStoreProvider,
        embeddingProvider: index.embeddingProvider,
      }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [indexes, isGraphList]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/indexes/new',
      title: isGraphList ? 'Knowledge Graphs' : 'Semantic Indexes',
    }));
  }, [isGraphList]);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getIndexesAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 5,
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
    setSearchModalOpen(false);
    setSelectedIndex({});
  };

  const openSearch = (index) => {
    setSelectedIndex(index);
    setSearchModalOpen(true);
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
      title: 'Store Type',
      dataIndex: 'storeType',
      render: (_, { storeType }) => (
        <div>{storeType}</div>
      )
    },
    {
      title: 'Store',
      dataIndex: 'store',
      render: (_, { store }) => (
        <Tag>{store}</Tag>
      )
    },
    {
      title: 'Embedding Provider',
      dataIndex: 'embeddingProvider',
      render: (_, { embeddingProvider }) => (
        <Tag>{embeddingProvider}</Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 225,
      render: (_, record) => (
        <Space size="middle">
          {record.storeType === 'Vector' ?
            <Button type="link"
              style={{ paddingLeft: 0 }}
              onClick={() => openSearch(record)}
            >
              Search
            </Button>
            : null
          }
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/indexes/${record.key}`)}
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
  const titleField = 'text';
  const index = indexes[selectedIndex.key];
  let indexParams;
  if (index) {
    indexParams = {
      nodeLabel: index.nodeLabel,
      embeddingModel: index.embeddingModel,
      vectorStoreProvider: index.vectorStoreProvider,
    };
  }

  // console.log('selectedIndex:', selectedIndex);

  return (
    <>
      {contextHolder}
      <SearchModal
        onCancel={onSearchCancel}
        open={searchModalOpen}
        indexName={selectedIndex.name}
        theme={isDarkMode ? 'dark' : 'light'}
        titleField={titleField}
        indexParams={indexParams}
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
