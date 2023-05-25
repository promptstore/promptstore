import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { Button, Space, Table, Tag, message } from 'antd';

import NavbarContext from '../../context/NavbarContext';
import {
  deleteFunctionsAsync,
  getFunctionsAsync,
  selectLoading,
  selectFunctions,
} from './functionsSlice';
import {
  getModelsAsync,
  selectLoaded as selectModelsLoaded,
  selectModels,
} from '../models/modelsSlice';

export function FunctionsList() {

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const functions = useSelector(selectFunctions);
  const loading = useSelector(selectLoading);
  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);

  const data = useMemo(() => {
    const list = Object.values(functions).map((func) => ({
      key: func.id,
      name: func.name,
      implementations: func.implementations,
      tags: func.tags,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [functions]);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);

  const dispatch = useDispatch();

  const location = useLocation();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/functions/new',
      title: 'Semantic Functions',
    }));
    dispatch(getModelsAsync());
    dispatch(getFunctionsAsync());
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
    dispatch(deleteFunctionsAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const getColor = (modelType) => {
    if (isDarkMode) {
      return modelType === 'api' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)';
    }
    return modelType === 'api' ? '#87d068' : '#2db7f5';
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/functions/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Implementations',
      dataIndex: 'implementations',
      render: (_, { implementations = [] }) => (
        <Space size={[0, 8]} wrap>
          {implementations.map((impl) => (
            impl.modelId && modelsLoaded ?
              <Tag key={impl.modelId}
                color={getColor(models[impl.modelId].type)}
              >
                {models[impl.modelId].key}
              </Tag>
              : null
          ))}
        </Space>
      )
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      width: '100%',
      render: (_, { tags = [] }) => (
        <Space size={[0, 8]} wrap>
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
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
