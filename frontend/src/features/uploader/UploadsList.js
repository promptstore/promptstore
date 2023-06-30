import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Modal, Space, Table } from 'antd';
import {
  FileExcelOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
} from '@ant-design/icons';
import hr from '@tsmx/human-readable';

import { getExtension, getHumanFriendlyDelta } from '../../utils';

import { ContentView } from '../../components/ContentView';
import { IndexModal } from './IndexModal';
import {
  deleteUploadsAsync,
  getUploadContentAsync,
  getUploadsAsync,
  indexDocumentAsync,
  selectLoading,
  selectUploaded,
  selectUploads,
} from './fileUploaderSlice';

const getDocIcon = (ext) => {
  switch (ext) {
    case 'csv':
      return <FileExcelOutlined style={{
        color: '#217346',
        fontSize: '1.5em',
      }} />;

    case 'txt':
      return <FileTextOutlined style={{
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: '1.5em',
      }} />;

    case 'docx':
      return <FileWordOutlined style={{
        color: '#2b579a',
        fontSize: '1.5em',
      }} />;

    case 'pdf':
      return <FilePdfOutlined style={{
        color: '#F40F02',
        fontSize: '1.5em',
      }} />;

    default:
      return <FileOutlined style={{
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: '1.5em',
      }} />;
  }
};

export function UploadsList({ sourceId }) {

  const [isIndexModalOpen, setIsIndexModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);

  const loading = useSelector(selectLoading);
  const uploaded = useSelector(selectUploaded);
  const uploads = useSelector(selectUploads);

  const sourceUploads = uploads[sourceId] || [];

  const data = useMemo(() => sourceUploads.map((doc) => ({
    key: doc.etag,
    id: doc.id,
    name: doc.name,
    size: doc.size,
    lastModified: doc.lastModified,
    ext: getExtension(doc.name),
  })), [uploads]);

  const upload = useMemo(() => {
    if (!selectedId) return null;
    return sourceUploads.find((doc) => doc.id === selectedId);
  }, [selectedId, uploads]);

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getUploadsAsync({ sourceId }));
  }, []);

  useEffect(() => {
    if (uploaded) {
      dispatch(getUploadsAsync({ sourceId }));
    }
  }, [uploaded]);

  useEffect(() => {
    if (selectedId && !upload.content) {
      dispatch(getUploadContentAsync(sourceId, selectedId, 1000 * 1024));
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
    dispatch(deleteUploadsAsync({ sourceId, uploads: deleteList }));
    setSelectedRowKeys([]);
  };

  const onIndexCancel = () => {
    setIsIndexModalOpen(false);
  };

  const onIndexSubmit = (values) => {
    dispatch(indexDocumentAsync({
      filepath: selectedRow.name,
      params: values,
    }));
    setIsIndexModalOpen(false);
    setSelectedRow(null);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const openIndex = (record) => {
    setSelectedRow(record);
    setIsIndexModalOpen(true);
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
          {name.match(`${sourceId}/(.*)`)[1]}
        </a>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'ext',
      render: (_, { ext }) => (
        <div style={{ textAlign: 'center' }}>
          {getDocIcon(ext)}
        </div>
      ),
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
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => openIndex(record)}
          >
            Index
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
      <Modal
        open={isModalOpen}
        title="Content Preview"
        width={'90%'}
        bodyStyle={{ height: 500, overflowY: 'auto' }}
        onCancel={onCancel}
        onOk={onCancel}
      >
        <ContentView upload={upload} />
      </Modal>
      <IndexModal
        ext={selectedRow?.ext}
        onCancel={onIndexCancel}
        onSubmit={onIndexSubmit}
        open={isIndexModalOpen}
      />
      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <Button danger type="primary" disabled={!hasSelected} onClick={onDelete}>
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
