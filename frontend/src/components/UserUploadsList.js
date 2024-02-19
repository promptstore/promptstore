import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Modal, Table } from 'antd';
import {
  FileExcelOutlined,
  FileMarkdownOutlined,
  FileOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileTextOutlined,
  FileWordOutlined,
} from '@ant-design/icons';
import hr from '@tsmx/human-readable';

import { ContentView } from './ContentView';
import {
  selectLoading as selectDataSourcesLoading,
} from '../features/dataSources/dataSourcesSlice';
import { getExtension, getHumanFriendlyDelta } from '../utils';

import {
  deleteUploadsAsync,
  getUploadContentAsync,
  getUploadsAsync,
  selectLoading,
  selectUploads,
} from '../features/apps/appUploaderSlice';

export function UserUploadsList({ loading, workspaceId, appId }) {

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const dataSourcesLoading = useSelector(selectDataSourcesLoading);
  const uploadsLoading = useSelector(selectLoading);
  const uploads = useSelector(selectUploads);

  const tableLoading = loading || uploadsLoading;

  const sourceUploads = uploads[appId] || [];

  const data = useMemo(() => {
    const list = sourceUploads.map((doc) => ({
      key: doc.etag,
      id: doc.id,
      name: doc.name,
      size: doc.size,
      lastModified: doc.lastModified,
      ext: getExtension(doc.name),
      filename: doc.filename,
    }));
    list.sort((a, b) => a.name < b.name ? -1 : 1);
    return list;
  }, [sourceUploads]);

  const upload = useMemo(() => {
    if (!selectedId) return null;
    return sourceUploads.find((doc) => doc.id === selectedId);
  }, [selectedId, uploads]);

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getUploadsAsync({ appId }));
  }, []);

  useEffect(() => {
    if (selectedId && !upload.content) {
      dispatch(getUploadContentAsync(appId, selectedId, 1000 * 1024));
    }
  }, [selectedId]);

  const onCancel = () => {
    setIsModalOpen(false);
    setSelectedId(null);
  };

  const onDelete = () => {
    const deleteList = [];
    for (const key of selectedRowKeys) {
      const found = sourceUploads.find((u) => u.etag === key);
      if (found) {
        deleteList.push(found);
      }
    }
    dispatch(deleteUploadsAsync({ workspaceId, appId, uploads: deleteList }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const showContent = (id) => {
    setSelectedId(id);
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      width: '100%',
      render: (_, { id, name }) => (
        <a href='#'
          onClick={() => showContent(id)}
        >
          {name.match(`${workspaceId}/(.*)`)[1]}
        </a>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'ext',
      align: 'center',
      render: (_, { ext }) => getDocIcon(ext),
      className: 'col-hdr-nowrap',
    },
    {
      title: 'Size',
      dataIndex: 'size',
      render: (_, { size }) => (
        <span style={{ whiteSpace: 'nowrap' }}>{hr.fromBytes(size)}</span>
      ),
      className: 'col-hdr-nowrap',
    },
    {
      title: 'Last Modified',
      dataIndex: 'lastModified',
      render: (_, { lastModified }) => (
        <span style={{ whiteSpace: 'nowrap' }}>{getHumanFriendlyDelta(lastModified)}</span>
      ),
      className: 'col-hdr-nowrap',
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
      <Modal
        open={isModalOpen}
        title="Content Preview"
        width={'75%'}
        bodyStyle={{ height: 500, overflowY: 'auto' }}
        onCancel={onCancel}
        onOk={onCancel}
      >
        <ContentView upload={upload} loading={dataSourcesLoading} />
      </Modal>
      <div id="user-uploads-table" style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <Button danger type="primary" disabled={!hasSelected} onClick={onDelete}>
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
          loading={tableLoading}
          pagination={false}
          rowClassName="document-list-row"
        />
      </div>
    </>
  );
};

const getDocIcon = (ext) => {
  switch (ext) {
    case 'csv':
    case 'xlsx':
      return <FileExcelOutlined style={{
        color: '#217346',
        fontSize: '1.5em',
      }} />;

    case 'doc':
    case 'docx':
      return <FileWordOutlined style={{
        color: '#2b579a',
        fontSize: '1.5em',
      }} />;

    case 'md':
      return <FileMarkdownOutlined style={{
        color: '#094ab2',
        fontSize: '1.5em',
      }} />;

    case 'pdf':
      return <FilePdfOutlined style={{
        color: '#F40F02',
        fontSize: '1.5em',
      }} />;

    case 'ppt':
    case 'pptx':
      return <FilePptOutlined style={{
        color: '#d24726',
        fontSize: '1.5em',
      }} />;

    case 'txt':
      return <FileTextOutlined style={{
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: '1.5em',
      }} />;

    default:
      return <FileOutlined style={{
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: '1.5em',
      }} />;
  }
};
