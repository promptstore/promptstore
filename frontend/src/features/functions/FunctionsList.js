import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tree,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  AppstoreOutlined,
  CheckOutlined,
  DownloadOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import debounce from 'lodash.debounce';
import useLocalStorageState from 'use-local-storage-state';
import isEmpty from 'lodash.isempty';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getModelsAsync,
  selectLoaded as selectModelsLoaded,
  selectLoading as selectModelsLoading,
  selectModels,
} from '../models/modelsSlice';
import {
  getAllProvidersAsync,
  getCustomModelProvidersAsync,
  selectProviders,
} from '../models/modelProvidersSlice';
import {
  getPromptSetsAsync,
  selectLoaded as selectPromptSetsLoaded,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';
import {
  getSettingsAsync,
  selectLoading as selectSettingsLoading,
  selectSettings,
} from '../settings/settingsSlice';
import {
  duplicateObjectAsync,
  objectUploadAsync,
  selectUploading,
} from '../uploader/fileUploaderSlice';
import { getColor, intersects } from '../../utils';

import {
  deleteFunctionsAsync,
  getFunctionsAsync,
  selectLoaded,
  selectLoading,
  selectFunctions,
} from './functionsSlice';

const { Search } = Input;

const TAGS_KEY = 'functionTags';

export function FunctionsList() {

  const [filterMultimodal, setFilterMultimodal] = useLocalStorageState('functions-filter-multimodal', { defaultValue: false });
  const [filterPublic, setFilterPublic] = useLocalStorageState('public-functions', { defaultValue: false });
  const [filterSystem, setFilterSystem] = useLocalStorageState('inherited-functions', { defaultValue: false });
  const [layout, setLayout] = useLocalStorageState('functions-layout', { defaultValue: 'grid' });
  const [page, setPage] = useLocalStorageState('functions-list-page', { defaultValue: 1 });
  const [searchValue, setSearchValue] = useLocalStorageState('functions-search-value', { defaultValue: '' });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedImpls, setSelectedImpls] = useLocalStorageState('selected-function-impls', { defaultValue: [] });
  const [selectedProviders, setSelectedProviders] = useLocalStorageState('selected-function-providers', { defaultValue: [] });
  const [selectedTags, setSelectedTags] = useLocalStorageState('selected-function-tags', { defaultValue: [] });
  const [numItems, setNumItems] = useLocalStorageState('functions-num-items', { defaultValue: 12 });

  const functions = useSelector(selectFunctions);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);
  const modelsLoading = useSelector(selectModelsLoading);
  const promptSets = useSelector(selectPromptSets);
  const promptSetsLoaded = useSelector(selectPromptSetsLoaded);
  const providers = useSelector(selectProviders);
  const settings = useSelector(selectSettings);
  const settingsLoading = useSelector(selectSettingsLoading);
  const uploading = useSelector(selectUploading);

  const data = useMemo(() => {
    if (layout === 'grid' && isEmpty(functions)) {
      // show loading cards
      return [...Array(numItems).keys()].map(key => ({ key }));
    } else {
      const list = Object.values(functions)
        .filter((func) => func.name.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1)
        .filter((func) => selectedTags?.length ? intersects(func.tags, selectedTags) : true)
        .filter((func) => selectedImpls?.length ? intersects(func.implementations.map(impl => impl.modelId), selectedImpls) : true)
        .filter((func) => filterMultimodal ? func.implementations.some(impl => models[impl.modelId]?.multimodal) : true)
        .filter((func) => filterPublic ? true : !func.isPublic)
        .filter((func) => filterSystem ? true : !func.isSystem)
        .filter((func) =>
          selectedProviders?.length && modelsLoaded ?
            intersects(func.implementations.map(impl => models[impl.modelId]?.provider), selectedProviders) ||
            intersects(func.implementations.map(impl => models[impl.modelId]?.type), selectedProviders)
            : true)
        .map((func) => ({
          key: func.id,
          name: func.name,
          implementations: func.implementations,
          tags: func.tags,
          isPublic: func.isPublic,
          isSystem: func.isSystem,
          description: func.description,
        }));
      list.sort((a, b) => a.name > b.name ? 1 : -1);
      return list;
    }
  }, [functions, filterMultimodal, filterPublic, filterSystem, models, modelsLoaded, searchValue, selectedImpls, selectedTags, selectedProviders]);

  const modelOptions = useMemo(() => {
    const list = Object.values(models)
      .map((m) => ({
        label: m.name,
        value: m.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [models]);

  const providerOptions = useMemo(() => {
    const list = [
      {
        label: 'Custom',
        value: 'api',
      },
    ];
    if (providers.all) {
      list.push(...providers.all.map(p => ({
        label: p.name,
        value: p.key,
      })));
    }
    if (providers.custom) {
      list.push(...providers.custom.map(p => ({
        label: p.name,
        value: p.key,
      })));
    }
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [providers]);

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
      createLink: '/functions/new/edit',
      title: 'Semantic Functions',
    }));
    dispatch(getAllProvidersAsync());
    dispatch(getCustomModelProvidersAsync());
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getModelsAsync({ workspaceId }));
      dispatch(getPromptSetsAsync({ workspaceId }));
      dispatch(getSettingsAsync({ keys: [TAGS_KEY], workspaceId }));
      dispatch(getFunctionsAsync({
        workspaceId,
        minDelay: layout === 'grid' ? 1000 : 0,
      }));
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

  useEffect(() => {
    if (loaded) {
      setNumItems(Object.keys(functions).length);
    }
  }, [loaded, functions]);

  const handleDuplicate = (key) => {
    const func = functions[key];
    dispatch(duplicateObjectAsync({
      obj: func,
      type: 'function',
      workspaceId: selectedWorkspace.id,
    }));
  };

  const onDelete = () => {
    dispatch(deleteFunctionsAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  // const onSearch = debounce((q) => {
  //   setSearchValue(q);
  // }, 1000);

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
          {implementations.map((impl, i) => (
            impl.modelId && modelsLoaded && models[impl.modelId] ?
              <Tag key={'impl-' + i}
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
      align: 'center',
      render: (_, { isPublic }) => (
        <div style={{ fontSize: '1.5em' }}>
          <span>{isPublic ? <CheckOutlined /> : ''}</span>
        </div>
      )
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      render: (_, { tags = [] }) => (
        <Space size={[8, 8]} wrap>
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 225,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button type="link"
            onClick={() => navigate(`/functions/${record.key}`)}
            style={{ paddingLeft: 0 }}
          >
            View
          </Button>
          <Button type="link"
            onClick={() => navigate(`/functions/${record.key}/edit`)}
            style={{ paddingLeft: 0 }}
          >
            Edit
          </Button>
          <Button type="link"
            onClick={() => handleDuplicate(record.key)}
            style={{ paddingLeft: 0 }}
          >
            Duplicate
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

  const selectedFunctions = useMemo(() => {
    const fns = [];
    if (loaded && modelsLoaded && promptSetsLoaded) {
      const funcs = selectedRowKeys.map(id => functions[id]);
      for (const func of funcs) {
        const model = models[func.modelId];
        const promptSet = promptSets[func.promptSetId];
        fns.push({ ...func, model, promptSet });
      }
    }
    return fns;
  }, [functions, loaded, modelsLoaded, promptSetsLoaded]);

  const onUpload = (info) => {
    if (info.file.status === 'uploading') {
      return;
    }
    if (info.file.status === 'done') {
      dispatch(objectUploadAsync({
        file: info.file,
        type: 'function',
        workspaceId: selectedWorkspace.id,
      }));
    }
  };

  const treeData = [
    {
      title: 'All',
      key: 'all',
      children: tagOptions.map(t => ({
        title: <Typography.Text ellipsis>{t.label}</Typography.Text>,
        key: t.value,
      })),
    }
  ];

  const selectFolder = (selectedKeys) => {
    if (selectedKeys[0] === 'all') {
      setSelectedTags([]);
    } else {
      setSelectedTags(selectedKeys);
    }
  };

  const providerTreeData = [
    {
      title: 'All',
      key: 'all',
      children: providerOptions.map(p => ({
        title: <Typography.Text ellipsis>{p.label}</Typography.Text>,
        key: p.value,
      })),
    }
  ];

  const selectProvider = (selectedKeys) => {
    if (selectedKeys[0] === 'all') {
      setSelectedProviders([]);
    } else {
      setSelectedProviders(selectedKeys);
    }
  };

  return (
    <>
      {contextHolder}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
              Delete
            </Button>
            {hasSelected ?
              <>
                <span>
                  Selected {selectedRowKeys.length} items
                </span>
                <Download filename={'functions.json'} payload={selectedFunctions}>
                  <Button type="text" icon={<DownloadOutlined />}>
                    Export
                  </Button>
                </Download>
              </>
              : null
            }
          </div>
          <Search allowClear
            placeholder="search filter"
            // onSearch={onSearch}
            style={{ width: 220 }}
            onChange={ev => setSearchValue(ev.target.value)}
            value={searchValue}
          />
          <Select allowClear mode="multiple"
            options={modelOptions}
            optionFilterProp="label"
            loading={modelsLoading}
            placeholder="select implementations"
            onChange={setSelectedImpls}
            style={{ width: 220 }}
            value={selectedImpls}
          />
          {/* <Select allowClear mode="multiple"
            options={tagOptions}
            optionFilterProp="label"
            loading={settingsLoading}
            placeholder="select tags"
            onChange={setSelectedTags}
            style={{ width: 220 }}
            value={selectedTags}
          /> */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={filterPublic}
              onChange={setFilterPublic}
            />
            <div>Public</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={filterSystem}
              onChange={setFilterSystem}
            />
            <div>System</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={filterMultimodal}
              onChange={setFilterMultimodal}
            />
            <div>Multimodal</div>
          </div>
          <Upload
            name="upload"
            showUploadList={false}
            customRequest={dummyRequest}
            beforeUpload={beforeUpload}
            onChange={onUpload}
          >
            <Button type="text" loading={uploading} icon={<UploadOutlined />}>
              Import
            </Button>
          </Upload>
          <div style={{ flex: 1 }}></div>
          <Segmented
            onChange={setLayout}
            value={layout}
            style={{ background: 'rgba(0, 0, 0, 0.25)' }}
            options={[
              {
                label: <UnorderedListOutlined />,
                value: 'list'
              },
              {
                label: <AppstoreOutlined />,
                value: 'grid'
              },
            ]}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'start', gap: 16, width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="folders">
              <div className="heading-wrapper">
                <div className="heading">
                  Tags
                </div>
              </div>
              <Tree
                defaultExpandAll
                treeData={treeData}
                onSelect={selectFolder}
                defaultSelectedKeys={selectedTags}
                height={200}
              />
            </div>
            <div className="folders">
              <div className="heading-wrapper">
                <div className="heading">
                  Providers
                </div>
              </div>
              <Tree
                defaultExpandAll
                treeData={providerTreeData}
                onSelect={selectProvider}
                defaultSelectedKeys={selectedProviders}
                height={200}
              />
            </div>
          </div>
          {layout === 'grid' ?
            <Space wrap size="large">
              {data.map(f =>
                <Card key={f.key} className="function-card" title={f.name} style={{ width: 350, height: 225 }} loading={loading}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: 121 }}>
                    <Typography.Text ellipsis>
                      {f.description}
                    </Typography.Text>
                    <Space size={8} wrap>
                      <div className="inline-label">imps</div>
                      {f.implementations?.map((impl) => (
                        impl.modelId && modelsLoaded && models[impl.modelId] ?
                          <Tag key={impl.modelId}
                            color={getColor(models[impl.modelId].type, isDarkMode)}
                          >
                            {models[impl.modelId].key}
                          </Tag>
                          : null
                      ))}
                    </Space>
                    {f.tags?.length ?
                      <Space size={8} wrap>
                        <div className="inline-label">tags</div>
                        {f.tags.map(t => <Tag key={t}>{t}</Tag>)}
                      </Space>
                      : null
                    }
                    <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 16, marginTop: 'auto' }}>
                      <Link to={`/functions/${f.key}/edit`}>Edit</Link>
                      <Link to={`/functions/${f.key}`}>View</Link>
                    </div>
                  </div>
                </Card>
              )}
            </Space>
            :
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
          }
        </div>
      </div>
    </>
  );
};

const beforeUpload = (file) => {
  // console.log('file:', file);

  const isJSON = file.type === 'application/json';

  if (!isJSON) {
    message.error('You may only upload a JSON file.');
  }

  const isLt2M = file.size / 1024 / 1024 < 100;

  if (!isLt2M) {
    message.error('File must be smaller than 100MB.');
  }

  return isJSON && isLt2M;
};

// https://stackoverflow.com/questions/51514757/action-function-is-required-with-antd-upload-control-but-i-dont-need-it
const dummyRequest = ({ file, onSuccess }) => {
  setTimeout(() => {
    onSuccess('ok');
  }, 20);
};
