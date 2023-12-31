import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
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
import {
  getSettingAsync,
  selectLoading as selectSettingsLoading,
  selectSettings,
} from './settingsSlice';

const { Search } = Input;

const TAGS_KEY = 'promptSetTags';

const intersects = (arr1 = [], arr2 = []) => {
  return arr1.filter(v => arr2.includes(v)).length > 0;
};

export function PromptSetsList() {

  const [filterPublic, setFilterPublic] = useLocalStorageState('public-prompt-sets', { defaultValue: false });
  const [filterTemplates, setFilterTemplates] = useLocalStorageState('filter-templates', { defaultValue: false });
  const [layout, setLayout] = useLocalStorageState('prompt-sets-layout', { defaultValue: 'grid' });
  const [page, setPage] = useLocalStorageState('prompt-sets-list-page', { defaultValue: 1 });
  const [searchValue, setSearchValue] = useState('');
  const [selectedTags, setSelectedTags] = useLocalStorageState('selected-promptset-tags', { defaultValue: [] });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [numItems, setNumItems] = useLocalStorageState('prompt-sets-num-items', { defaultValue: 12 });

  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
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
          .filter((ps) => filterPublic ? ps.isPublic : true)
          .map((ps) => ({
            key: ps.id,
            name: ps.name,
            prompt: ps.prompts?.[0]?.prompt,
            summary: ps.summary,
            skill: ps.skill,
            tags: ps.tags,
            isTemplate: ps.isTemplate,
            isPublic: ps.isPublic,
          }));
      list.sort((a, b) => a.name > b.name ? 1 : -1);
      return list;
    }
  }, [promptSets, searchValue, filterPublic, filterTemplates, selectedTags]);

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
      dispatch(getSettingAsync({ workspaceId: selectedWorkspace.id, key: TAGS_KEY }));
      dispatch(getPromptSetsAsync({
        workspaceId: selectedWorkspace.id,
        minDelay: layout === 'grid' ? 2000 : 0,
      }));
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

  useEffect(() => {
    if (loaded) {
      setNumItems(Object.keys(promptSets).length);
    }
  }, [loaded, promptSets]);

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
      render: (_, { isPublic }) => (
        <div style={{ fontSize: '1.5em', textAlign: 'center' }}>
          <span>{isPublic ? <CheckOutlined /> : ''}</span>
        </div>
      )
    },
    {
      title: 'Template',
      dataIndex: 'template',
      render: (_, { isTemplate }) => (
        <div style={{ fontSize: '1.5em', textAlign: 'center' }}>
          <span>{isTemplate ? <CheckOutlined /> : ''}</span>
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
            onClick={() => navigate(`/prompt-sets/${record.key}`)}
          >
            View
          </Button>
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/prompt-sets/${record.key}/edit`)}
          >
            Edit
          </Button>
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/design/${record.key}`)}
          >
            Design
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

  return (
    <>
      {contextHolder}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
            Delete
          </Button>
          {hasSelected ?
            <>
              <div style={{ marginLeft: 8 }}>
                Selected {selectedRowKeys.length} items
              </div>
              <Download filename={'prompt_sets.json'} payload={selectedPromptSets}>
                <Button type="text" icon={<DownloadOutlined />} />
              </Download>
            </>
            : null
          }
          <Search allowClear
            placeholder="find entries"
            onSearch={onSearch}
            style={{ marginLeft: 8, width: 220 }}
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
            checked={filterTemplates}
            onChange={setFilterTemplates}
            style={{ marginLeft: 8 }}
          />
          <div style={{ marginLeft: 8 }}>Templates</div>
          <Switch
            checked={filterPublic}
            onChange={setFilterPublic}
            style={{ marginLeft: 8 }}
          />
          <div style={{ marginLeft: 8 }}>Public</div>
          <div style={{ marginLeft: 16 }}>
            <Upload
              name="upload"
              showUploadList={false}
              customRequest={dummyRequest}
              beforeUpload={beforeUpload}
              onChange={onUpload}
            >
              <Button type="text" loading={uploading} icon={<UploadOutlined />} />
            </Upload>
          </div>
          <div style={{ flex: 1 }}></div>
          <Radio.Group
            buttonStyle="solid"
            onChange={(ev) => setLayout(ev.target.value)}
            optionType="button"
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
            value={layout}
          />
        </div>
        {layout === 'grid' ?
          <Space wrap size="large">
            {data.map(p =>
              <Card key={p.key} title={p.name} style={{ width: 350, height: 200 }} loading={loading}>
                <div style={{ display: 'flex', flexDirection: 'column', height: 96 }}>
                  <div style={{ height: 30 }}>
                    Skill: <span style={{ color: '#177ddc' }}>{p.skill}</span>
                  </div>
                  <div style={{ height: 30 }}>
                    <Typography.Text ellipsis>
                      {p.description || p.prompt || p.summary}
                    </Typography.Text>
                  </div>
                  <Space wrap size="small">
                    {(p.tags || []).map(t => <Tag key={t}>{t}</Tag>)}
                  </Space>
                  <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 16, marginTop: 'auto' }}>
                    <Link to={`/design/${p.key}`}>Design</Link>
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
          />
        }
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
