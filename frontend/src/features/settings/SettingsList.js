import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input, Select, Space, Table, Tag, Upload, message } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import debounce from 'lodash.debounce';
import useLocalStorageState from 'use-local-storage-state';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  objectUploadAsync,
  selectUploading,
} from '../uploader/fileUploaderSlice';
import {
  deleteSettingsAsync,
  getSettingsAsync,
  selectLoading,
  selectSettings,
} from './settingsSlice';

const { Search } = Input;

const intersects = (arr1 = [], arr2 = []) => {
  return arr1.filter(v => arr2.includes(v)).length > 0;
};

export function SettingsList() {

  const [page, setPage] = useLocalStorageState('settings-list-page', 1);
  const [searchValue, setSearchValue] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedTags, setSelectedTags] = useLocalStorageState('selected-setting-tags', []);

  const loading = useSelector(selectLoading);
  const settings = useSelector(selectSettings);
  const uploading = useSelector(selectUploading);

  // console.log('settings:', settings);

  const data = useMemo(() => {
    const list = Object.values(settings)
      .filter((setting) => setting.name.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1)
      .filter((setting) => selectedTags?.length ? intersects(setting.tags, selectedTags) : true)
      .map((setting) => ({
        key: setting.id,
        name: setting.name,
        tags: setting.tags,
      }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [settings, searchValue, selectedTags]);

  const tagOptions = useMemo(() => {
    const setting = Object.values(settings).find(s => s.key === 'SETTING_TAGS');
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
      createLink: '/settings/new',
      title: 'Settings',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getSettingsAsync({ workspaceId: selectedWorkspace.id }));
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
    dispatch(deleteSettingsAsync({ ids: selectedRowKeys }));
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
          <Link to={`/settings/${key}`}>{name}</Link>
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
            onClick={() => navigate(`/settings/${record.key}`)}
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

  const selectedSettings = selectedRowKeys.map(id => settings[id]);

  const onUpload = (info) => {
    if (info.file.status === 'uploading') {
      return;
    }
    if (info.file.status === 'done') {
      dispatch(objectUploadAsync({
        file: info.file,
        type: 'setting',
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
          <span style={{ marginLeft: 8 }}>
            {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
          </span>
          <Download filename={'settings.json'} payload={selectedSettings}>
            <Button type="text" icon={<DownloadOutlined />} />
          </Download>
          <Search allowClear
            placeholder="find entries"
            onSearch={onSearch}
            style={{ marginLeft: 16, width: 250 }}
          />
          <Select allowClear mode="multiple"
            options={tagOptions}
            optionFilterProp="label"
            placeholder="select tags"
            onChange={setSelectedTags}
            style={{ marginLeft: 8, width: 250 }}
            value={selectedTags}
          />
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

const beforeUpload = (file) => {
  // console.log('file:', file);

  const isJSON = file.type === 'application/json';

  if (!isJSON) {
    message.error('You may only upload a JSON file.');
  }

  const isLt2M = file.size / 1024 / 1024 < 100;

  if (!isLt2M) {
    message.error('File must smaller than 100MB.');
  }

  return isJSON && isLt2M;
};

// https://stackoverflow.com/questions/51514757/action-function-is-required-with-antd-upload-control-but-i-dont-need-it
const dummyRequest = ({ file, onSuccess }) => {
  setTimeout(() => {
    onSuccess('ok');
  }, 20);
};
