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
import difference from 'lodash.difference';
import isEmpty from 'lodash.isempty';
import useLocalStorageState from 'use-local-storage-state';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import usePrevious from '../../hooks/usePrevious';
import { intersects } from '../../utils';
import {
  getFunctionsAsync,
  createFunctionAsync,
  selectFunctions,
} from '../functions/functionsSlice';
import {
  getModelByKeyAsync,
  selectModels,
} from '../models/modelsSlice';
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
import {
  deletePromptSetsAsync,
  getPromptSetsAsync,
  selectLoaded,
  selectLoading,
  selectPromptSets,
} from './promptSetsSlice';

const { Search } = Input;

const DEFAULT_MODEL_KEY = 'gpt-3.5-turbo-0613';
const TAGS_KEY = 'promptSetTags';

export function PromptSetsList() {

  const [filterPublic, setFilterPublic] = useLocalStorageState('public-prompt-sets', { defaultValue: false });
  const [filterSystem, setFilterSystem] = useLocalStorageState('inherited-prompt-sets', { defaultValue: false });
  const [filterTemplates, setFilterTemplates] = useLocalStorageState('filter-templates', { defaultValue: false });
  const [layout, setLayout] = useLocalStorageState('prompt-sets-layout', { defaultValue: 'grid' });
  const [page, setPage] = useLocalStorageState('prompt-sets-list-page', { defaultValue: 1 });
  const [searchValue, setSearchValue] = useState('');
  const [selectedTags, setSelectedTags] = useLocalStorageState('selected-promptset-tags', { defaultValue: [] });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [numItems, setNumItems] = useLocalStorageState('prompt-sets-num-items', { defaultValue: 12 });
  const [createdFunctions, setCreatedFunctions] = useState({});

  const functions = useSelector(selectFunctions);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const models = useSelector(selectModels);
  const promptSets = useSelector(selectPromptSets);
  const settings = useSelector(selectSettings);
  const settingsLoading = useSelector(selectSettingsLoading);
  const uploading = useSelector(selectUploading);

  const data = useMemo(() => {
    if (layout === 'grid' && isEmpty(promptSets)) {
      // show loading cards
      return [...Array(numItems).keys()].map(key => ({ key }));
    } else {
      const list =
        Object.values(promptSets)
          .filter((ps) => ps.name.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1)
          .filter((ps) => selectedTags?.length ? intersects(ps.tags, selectedTags) : true)
          .filter((ps) => filterTemplates ? ps.isTemplate : true)
          .filter((ps) => filterPublic ? true : !ps.isPublic)
          .filter((ps) => filterSystem ? true : !ps.isSystem)
          .map((ps) => ({
            key: ps.id,
            name: ps.name,
            description: ps.description,
            prompt: ps.prompts?.[0]?.prompt,
            summary: ps.summary,
            skill: ps.skill,
            tags: ps.tags,
            isTemplate: ps.isTemplate,
            isPublic: ps.isPublic,
            isSystem: ps.isSystem,
          }));
      list.sort((a, b) => a.name > b.name ? 1 : -1);
      return list;
    }
  }, [promptSets, searchValue, filterSystem, filterPublic, filterTemplates, selectedTags]);

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

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/prompt-sets/new/edit',
      title: 'Prompt Templates',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getSettingsAsync({ keys: [TAGS_KEY], workspaceId }));
      dispatch(getPromptSetsAsync({
        workspaceId,
        minDelay: layout === 'grid' ? 1000 : 0,
      }));
      dispatch(getModelByKeyAsync({
        workspaceId,
        key: DEFAULT_MODEL_KEY,
      }));
      dispatch(getFunctionsAsync({ workspaceId }));
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
      setNumItems(Object.keys(promptSets).length);
    }
  }, [loaded, promptSets]);

  // const previous = usePrevious({ functions });

  // useEffect(() => {
  //   const a = Object.keys(functions);
  //   if (a.length) {
  //     const b = Object.keys(previous?.functions || {});
  //     const diff = difference(a, b);
  //     if (diff.length) {
  //       const func = functions[diff[0]];
  //       const key = func.implementations?.[0]?.promptSetId;
  //       setCreatedFunctions(cur => ({
  //         ...cur,
  //         [key]: { func: func.id },
  //       }));
  //     }
  //   }
  // }, [functions]);

  useEffect(() => {
    const map = Object.values(functions).reduce((a, f) => {
      const key = f.implementations?.[0]?.promptSetId;
      a[key] = { func: f.id };
      return a;
    }, {});
    setCreatedFunctions(cur => ({
      ...cur,
      ...map,
    }));
  }, [functions]);

  const handleDuplicate = (key) => {
    const ps = promptSets[key];
    dispatch(duplicateObjectAsync({
      obj: ps,
      type: 'promptSet',
      workspaceId: selectedWorkspace.id,
    }));
  };

  const createFunction = (key) => {
    const model = Object.values(models).find(m => m.key === DEFAULT_MODEL_KEY);
    if (model) {
      // console.log('model:', model);
      const ps = promptSets[key];
      if (ps) {
        setCreatedFunctions(cur => ({
          ...cur,
          [key]: { loading: true },
        }));
        let mappingData;
        if (ps.arguments) {
          let properties;
          if (ps.arguments.type === 'array') {
            properties = ps.arguments.items.properties;
          } else {
            properties = ps.arguments.properties;
          }
          mappingData = Object.keys(properties).reduce((a, k) => {
            a[k] = k;
            return a;
          }, {});
          mappingData = JSON.stringify(mappingData, null, 2);
        }
        dispatch(createFunctionAsync({
          values: {
            name: ps.skill,
            workspaceId: selectedWorkspace.id,
            arguments: ps.arguments,
            implementations: [
              {
                modelId: model.id,
                promptSetId: ps.id,
                mappingData,
              }
            ]
          },
        }));
      } else {
        console.error('Prompt template not found with key:', key);
      }
    } else {
      console.error('Model not found with key:', DEFAULT_MODEL_KEY);
    }
  }

  const onDelete = () => {
    dispatch(deletePromptSetsAsync({ ids: selectedRowKeys }));
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
      onFilter: (value, record) => record.name.startsWith(value),
      filterMode: 'menu',
      filterSearch: true,
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/prompt-sets/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      render: (_, { summary }) => (
        <Typography.Text ellipsis style={{ minWidth: 250 }}>
          {summary}
        </Typography.Text>
      )
    },
    {
      title: 'Skill',
      dataIndex: 'skill',
      render: (_, { skill }) => <span>{skill}</span>
    },
    {
      title: 'Public',
      dataIndex: 'public',
      align: 'center',
      render: (_, { isPublic }) => (
        <div style={{ fontSize: '1.5em' }}>
          <span>{isPublic ? <CheckOutlined /> : ''}</span>
        </div>
      )
    },
    {
      title: 'Template',
      dataIndex: 'template',
      align: 'center',
      render: (_, { isTemplate }) => (
        <div style={{ fontSize: '1.5em' }}>
          <span>{isTemplate ? <CheckOutlined /> : ''}</span>
        </div>
      )
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      render: (_, { key, tags = [] }) => (
        <Space size={[0, 8]} wrap>
          {tags.map((tag) => (
            <Tag key={`${key}-${tag}`}>{tag}</Tag>
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
            onClick={() => navigate(`/prompt-sets/${record.key}`)}
            style={{ paddingLeft: 0 }}
          >
            View
          </Button>
          <Button type="link"
            onClick={() => navigate(`/prompt-sets/${record.key}/edit`)}
            style={{ paddingLeft: 0 }}
          >
            Edit
          </Button>
          <Button type="link"
            onClick={() => navigate(`/design/${record.key}`)}
            style={{ paddingLeft: 0 }}
          >
            Test
          </Button>
          {createdFunctions[record.key]?.func ?
            <Button type="link"
              onClick={() => navigate(`/functions/${createdFunctions[record.key].func}/edit`)}
              style={{ paddingLeft: 0 }}
            >
              Function
            </Button>
            :
            <Button type="link"
              loading={createdFunctions[record.key]?.loading}
              onClick={() => createFunction(record.key)}
              style={{ paddingLeft: 0 }}
            >
              Create Fn
            </Button>
          }
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

  const selectedPromptSets = selectedRowKeys.map(id => promptSets[id]);

  const onUpload = (info) => {
    if (info.file.status === 'uploading') {
      return;
    }
    if (info.file.status === 'done') {
      dispatch(objectUploadAsync({
        file: info.file,
        type: 'promptSet',
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
                <Download filename={'prompt_sets.json'} payload={selectedPromptSets}>
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
            onSearch={onSearch}
            style={{ width: 220 }}
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
              checked={filterTemplates}
              onChange={setFilterTemplates}
            />
            <div>Templates</div>
          </div>
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
          <Upload
            name="upload"
            showUploadList={false}
            customRequest={dummyRequest}
            beforeUpload={beforeUpload}
            onChange={onUpload}
          >
            <Button type="text"
              icon={<UploadOutlined />}
              loading={uploading}
            >
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
            />
          </div>
          {layout === 'grid' ?
            <Space wrap size="large">
              {data.map(p =>
                <Card key={p.key} className="ps-card" title={p.name} style={{ width: 350, height: 225 }} loading={loading}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: 121 }}>
                    <Typography.Text ellipsis>{p.description || p.prompt || p.summary}</Typography.Text>
                    <div>
                      <span className="inline-label">skill</span> <span style={{ color: '#177ddc' }}>{p.skill}</span>
                    </div>
                    {p.tags?.length ?
                      <Space wrap size="small">
                        <div className="inline-label">tags</div>
                        {p.tags.map(t => <Tag key={t} style={{ margin: 0 }}>{t}</Tag>)}
                      </Space>
                      : null
                    }
                    <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 16, marginTop: 'auto' }}>
                      <Link to={`/design/${p.key}`}>Test</Link>
                      <Link to={`/prompt-sets/${p.key}/edit`}>Edit</Link>
                      <Link to={`/prompt-sets/${p.key}`}>View</Link>
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
              rowClassName="promptset-list-row"
              style={{ maxWidth: '100%' }}
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
