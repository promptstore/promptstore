import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input, Select, Space, Switch, Table, Tag, message } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import debounce from 'lodash.debounce';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { getColor } from '../../utils';

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

import {
  deleteFunctionsAsync,
  getFunctionsAsync,
  selectLoading,
  selectFunctions,
} from './functionsSlice';

const { Search } = Input;

const TAGS_KEY = 'functionTags';

const intersects = (arr1 = [], arr2 = []) => {
  return arr1.filter(v => arr2.includes(v)).length > 0;
};

export function FunctionsList() {

  const [filterSystem, setFilterSystem] = useLocalStorageState('filter-system', false);
  const [page, setPage] = useLocalStorageState('functions-list-page', 1);
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
      .filter((func) => filterSystem ? func.isPublic : true)
      .map((func) => ({
        key: func.id,
        name: func.name,
        implementations: func.implementations,
        tags: func.tags,
        isPublic: func.isPublic,
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
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/functions/new',
      title: 'Semantic Functions',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getModelsAsync({ workspaceId }));
      dispatch(getFunctionsAsync({ workspaceId }));
      dispatch(getSettingAsync({ workspaceId, key: TAGS_KEY }));
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
                color={getColor(models[impl.modelId].type, isDarkMode)}
              >
                {models[impl.modelId].key}
              </Tag>
              : null
          ))}
        </Space>
      )
    },
    {
      title: 'Public',
      dataIndex: 'isPublic',
      render: (_, { isPublic }) => (
        <div style={{ fontSize: '1.5em', textAlign: 'center' }}>
          <span>{isPublic ? <CheckOutlined /> : ''}</span>
        </div>
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
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/functions/${record.key}`)}
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
          <Search allowClear
            placeholder="find entries"
            onSearch={onSearch}
            style={{ marginLeft: 16, width: 220 }}
          />
          <Select allowClear mode="multiple"
            options={modelOptions}
            optionFilterProp="label"
            loading={modelsLoading}
            placeholder="select implementations"
            onChange={setSelectedImpls}
            style={{ marginLeft: 8, width: 220 }}
            value={selectedImpls}
          />
          <Select allowClear mode="multiple"
            options={tagOptions}
            optionFilterProp="label"
            loading={settingsLoading}
            placeholder="select tags"
            onChange={setSelectedTags}
            style={{ marginLeft: 8, width: 220 }}
            value={selectedTags}
          />
          <Switch
            checked={filterSystem}
            onChange={setFilterSystem}
            style={{ marginLeft: 8 }}
          />
          <span style={{ marginLeft: 8 }}>Public functions</span>
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
          rowClassName="function-list-row"
        />
      </div>
    </>
  );
};
