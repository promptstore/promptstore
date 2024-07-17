import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Table, Upload, message } from 'antd';
import {
  DownloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import useLocalStorageState from 'use-local-storage-state';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  objectUploadAsync,
  selectUploading,
} from '../uploader/fileUploaderSlice';
import {
  deleteCompositionsAsync,
  getCompositionsAsync,
  selectLoading,
  selectCompositions,
} from './compositionsSlice';

export function CompositionsList() {

  const [page, setPage] = useLocalStorageState('compositions-list-page', { defaultValue: 1 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const compositions = useSelector(selectCompositions);
  const loading = useSelector(selectLoading);
  const uploading = useSelector(selectUploading);

  const data = useMemo(() => {
    const list = Object.values(compositions).map((comp) => ({
      key: comp.id,
      name: comp.name,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [compositions]);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/compositions/new',
      title: 'Compositions',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getCompositionsAsync({ workspaceId: selectedWorkspace.id }));
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
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/compositions/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 225,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/compositions/${record.key}`)}
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

  const selectedCompositions = selectedRowKeys.map(id => compositions[id]);

  const onUpload = (info) => {
    if (info.file.status === 'uploading') {
      return;
    }
    if (info.file.status === 'done') {
      dispatch(objectUploadAsync({
        file: info.file,
        type: 'composition',
        workspaceId: selectedWorkspace.id,
      }));
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
                <Download filename={'compositions.json'} payload={selectedCompositions}>
                  <Button type="text" icon={<DownloadOutlined />}>
                    Export
                  </Button>
                </Download>
              </>
              : null
            }
          </div>
          <Upload
            name="upload"
            showUploadList={false}
            customRequest={dummyRequest}
            beforeUpload={beforeUpload}
            onChange={onUpload}
          >
            <Button type="text" loading={uploading} icon={<UploadOutlined />}>
              Upload
            </Button>
          </Upload>
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
