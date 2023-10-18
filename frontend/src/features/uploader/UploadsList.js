import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Modal, Space, Table } from 'antd';
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
import useLocalStorageState from 'use-local-storage-state';
import { v4 as uuidv4 } from 'uuid';

import { ContentView } from '../../components/ContentView';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  createDataSourceAsync,
  selectDataSources,
  selectLoading as selectDataSourcesLoading,
} from '../dataSources/dataSourcesSlice';
import { IndexModal } from './IndexModal';
import { getExtension, getHumanFriendlyDelta } from '../../utils';

import {
  deleteUploadsAsync,
  getUploadContentAsync,
  getUploadsAsync,
  indexDocumentAsync,
  reloadContentAsync,
  selectLoading,
  selectUploads,
  selectReloading,
} from './fileUploaderSlice';

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

export function UploadsList({ workspaceId }) {

  const [correlationId, setCorrelationId] = useState({});
  const [isIndexModalOpen, setIsIndexModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useLocalStorageState('documents-list-page', { defaultValue: 1 });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);

  const dataSources = useSelector(selectDataSources);
  const dataSourcesLoading = useSelector(selectDataSourcesLoading);
  const loading = useSelector(selectLoading);
  const uploads = useSelector(selectUploads);
  const reloading = useSelector(selectReloading);

  const sourceUploads = uploads[workspaceId] || [];

  const { selectedWorkspace } = useContext(WorkspaceContext);

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
    dispatch(getUploadsAsync({ workspaceId }));
  }, []);

  useEffect(() => {
    if (selectedId && !upload.content) {
      dispatch(getUploadContentAsync(workspaceId, selectedId, 1000 * 1024));
    }
  }, [selectedId]);

  useEffect(() => {
    const source = Object.values(dataSources)
      .find(s => s.correlationId === correlationId[s.id]);
    if (source) {
      setCorrelationId((curr) => ({ ...curr, [source.id]: null }));
    }
  }, [correlationId, dataSources]);

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
    dispatch(deleteUploadsAsync({ workspaceId, uploads: deleteList }));
    setSelectedRowKeys([]);
  };

  const onIndexCancel = () => {
    setIsIndexModalOpen(false);
  };

  const onIndexSubmit = (values) => {
    dispatch(indexDocumentAsync({
      filepath: selectedRow.name,
      params: values,
      workspaceId: selectedWorkspace,
    }));
    setIsIndexModalOpen(false);
    setSelectedRow(null);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const createSource = (record) => {
    const { filename, id } = record;
    const re = /(?:\.([^.]+))?$/;
    const name = filename.replace(re, '');
    const ext = re.exec(filename)[1];
    const values = {
      name,
      type: 'document',
      documentType: ext,
      documents: [id],
      workspaceId: selectedWorkspace.id,
    };
    const correlationId = uuidv4();
    dispatch(createDataSourceAsync({ correlationId, values }));
    setCorrelationId((curr) => ({
      ...curr,
      [id]: correlationId,
    }));
  };

  const reloadContent = (record) => {
    dispatch(reloadContentAsync({
      workspaceId,
      uploadId: record.id,
      filepath: record.name,
    }));
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
        <Space direction="vertical">
          <Space size="middle">
            <Button type="link"
              style={{ paddingLeft: 0 }}
              onClick={() => showContent(record.id)}
            >
              Preview
            </Button>
            <Button type="link"
              loading={!!reloading[record.id]}
              style={{ paddingLeft: 0 }}
              onClick={() => reloadContent(record)}
            >
              Reload
            </Button>
          </Space>
          <Button type="link"
            loading={!!correlationId[record.key]}
            style={{ paddingLeft: 0 }}
            onClick={() => createSource(record)}
          >
            Create Source
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
        <ContentView upload={upload} loading={dataSourcesLoading} />
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
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            onChange: (page, pageSize) => setPage(page),
          }}
          rowClassName="document-list-row"
        />
      </div>
    </>
  );
};
