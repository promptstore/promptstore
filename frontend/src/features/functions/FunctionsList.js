import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { Button, Input, Select, Space, Switch, Table, Tag, message } from 'antd';
import { CheckCircleTwoTone } from '@ant-design/icons';
import debounce from 'lodash.debounce';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import {
  deleteFunctionsAsync,
  getFunctionsAsync,
  selectLoading,
  selectFunctions,
} from './functionsSlice';
import {
  getModelsAsync,
  selectLoaded as selectModelsLoaded,
  selectLoading as selectModelsLoading,
  selectModels,
} from '../models/modelsSlice';
import {
  getSettingAsync,
  selectLoading as selectSettingsLoading,
  selectSettings,
} from '../promptSets/settingsSlice';

const { Search } = Input;

const TAGS_KEY = 'functionTags';

const intersects = (arr1 = [], arr2 = []) => {
  return arr1.filter(v => arr2.includes(v)).length > 0;
};

export function FunctionsList() {

  const [filterSystem, setFilterSystem] = useLocalStorageState('filter-system', false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedImpls, setSelectedImpls] = useLocalStorageState('selected-function-impls', []);
  const [selectedTags, setSelectedTags] = useLocalStorageState('selected-function-tags', []);

  const functions = useSelector(selectFunctions);
  const loading = useSelector(selectLoading);
  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);
  const modelsLoading = useSelector(selectModelsLoading);
  const settings = useSelector(selectSettings);
  const settingsLoading = useSelector(selectSettingsLoading);

  const data = useMemo(() => {
    const list = Object.values(functions)
      .filter((func) => func.name.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1)
      .filter((func) => selectedTags?.length ? intersects(func.tags, selectedTags) : true)
      .filter((func) => selectedImpls?.length ? intersects(func.implementations.map(impl => impl.modelId), selectedImpls) : true)
      .filter((func) => filterSystem ? func.isSystem : true)
      .map((func) => ({
        key: func.id,
        name: func.name,
        implementations: func.implementations,
        tags: func.tags,
        isSystem: func.isSystem,
      }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [functions, filterSystem, searchValue, selectedImpls, selectedTags]);

  const modelOptions = useMemo(() => {
    const list = Object.values(models)
      .map((m) => ({
        label: m.name,
        value: m.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [models]);

  const tagOptions = useMemo(() => {
    const setting = Object.values(settings).find(s => s.key === TAGS_KEY);
    if (setting) {
      const list = [...setting.value];
      list.sort();
      return list.map(s => ({
        label: s,
        value: s,
      }));
    }
    return [];
  }, [settings]);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

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
    if (selectedWorkspace) {
      dispatch(getSettingAsync({ workspaceId: selectedWorkspace.id, key: TAGS_KEY }));
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
    dispatch(deleteFunctionsAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSearch = debounce((q) => {
    setSearchValue(q);
  }, 1000);

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
      title: 'System',
      dataIndex: 'isSystem',
      render: (_, { isSystem }) => (
        <div style={{ fontSize: '1.5em', textAlign: 'center' }}>
          <span>{isSystem ? <CheckCircleTwoTone twoToneColor="#52c41a" /> : ''}</span>
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
          <Search allowClear
            placeholder="find entries"
            onSearch={onSearch}
            style={{ marginLeft: 16, width: 250 }}
          />
          <Select allowClear mode="multiple"
            options={modelOptions}
            loading={modelsLoading}
            placeholder="select implementations"
            onChange={setSelectedImpls}
            style={{ marginLeft: 16, width: 250 }}
            value={selectedImpls}
          />
          <Select allowClear mode="multiple"
            options={tagOptions}
            loading={settingsLoading}
            placeholder="select tags"
            onChange={setSelectedTags}
            style={{ marginLeft: 16, width: 250 }}
            value={selectedTags}
          />
          <Switch
            checked={filterSystem}
            onChange={setFilterSystem}
            style={{ marginLeft: 8 }}
          />
          <span style={{ marginLeft: 8 }}>System functions</span>
        </div>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={data}
          loading={loading}
          rowClassName="function-list-row"
        />
      </div>
    </>
  );
};
