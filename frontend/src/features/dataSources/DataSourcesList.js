import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { Button, Modal, Space, Table, Tag, message } from 'antd';

// import { ContentView } from '../../components/ContentView';
import { DataSourceContentView } from '../../components/DataSourceContentView';
import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import { IndexModal } from '../uploader/IndexModal';
import {
  // getUploadContentAsync,
  getUploadsAsync,
  loadDocumentAsync,
  selectLoaded as selectUploadsLoaded,
  selectUploads,
} from '../uploader/fileUploaderSlice';

import {
  deleteDataSourcesAsync,
  getDataSourcesAsync,
  getDataSourceContentAsync,
  selectDataSources,
  selectLoading,
} from './dataSourcesSlice';

export function DataSourcesList() {

  const [isIndexModalOpen, setIsIndexModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const dataSources = useSelector(selectDataSources);
  const loading = useSelector(selectLoading);
  const uploads = useSelector(selectUploads);
  const uploadsLoaded = useSelector(selectUploadsLoaded);

  const data = useMemo(() => {
    const list = Object.values(dataSources).map((ds) => ({
      key: ds.id,
      name: ds.name,
      type: ds.type,
      documentId: ds.documentId,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [dataSources]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  const location = useLocation();

  const [messageApi, contextHolder] = message.useMessage();

  const dataSource = dataSources[selectedId];

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/data-sources/new',
      title: 'Data Sources',
    }));
    dispatch(getDataSourcesAsync());
  }, []);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 3,
      });
    }
  }, [location]);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getUploadsAsync({ sourceId: selectedWorkspace.id }));
    }
  }, [selectedWorkspace]);

  // useEffect(() => {
  //   if (selectedId && selectedWorkspace) {
  //     dispatch(getUploadContentAsync(selectedWorkspace.id, selectedId, 1000 * 1024)); // preview 1Mb
  //   }
  // }, [selectedId, selectedWorkspace]);
  useEffect(() => {
    if (selectedId) {
      dispatch(getDataSourceContentAsync(selectedId, 1000 * 1024)); // preview 1Mb
    }
  }, [selectedId]);

  const onDelete = () => {
    dispatch(deleteDataSourcesAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onIndexCancel = () => {
    setIsIndexModalOpen(false);
  };

  const onIndexSubmit = (values) => {
    const workspaceUploads = uploads[selectedWorkspace.id];
    const upload = workspaceUploads.find((u) => u.id === dataSource.documentId);
    // console.log('upload:', upload);
    if (upload) {
      if (dataSource.documentType === 'csv') {
        values = {
          ...values,
          documentId: dataSource.documentId,
          delimiter: dataSource.delimiter,
          quoteChar: dataSource.quoteChar,
        };
      } else if (dataSource.documentType === 'txt') {
        values = {
          ...values,
          documentId: dataSource.documentId,
          textProperty: dataSource.textProperty,
          splitter: dataSource.splitter,
          characters: dataSource.characters,
          functionId: dataSource.functionId,
        };
      }
      dispatch(loadDocumentAsync({
        filepath: upload.name,
        params: values,
      }));
    }
    setIsIndexModalOpen(false);
    setSelectedId(null);
  };

  const onPreviewCancel = () => {
    setIsPreviewModalOpen(false);
    setSelectedId(null);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const openIndex = (record) => {
    setSelectedId(record.key);
    setIsIndexModalOpen(true);
  };

  const openPreview = (record) => {
    // setSelectedId(record.documentId);
    setSelectedId(record.key);
    setIsPreviewModalOpen(true);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/data-sources/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: '100%',
      render: (_, { type }) => (
        <Tag>{type}</Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        record.type === 'document' && record.documentId ?
          <Space size="middle">
            <Button type="link"
              style={{ paddingLeft: 0 }}
              onClick={() => openPreview(record)}
            >
              Preview
            </Button>
            <Button type="link"
              disabled={!uploadsLoaded}
              style={{ paddingLeft: 0 }}
              onClick={() => openIndex(record)}
            >
              Index
            </Button>
          </Space>
          : null
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

  // const upload = useMemo(() => {
  //   if (selectedId && selectedWorkspace) {
  //     const workspaceUploads = uploads[selectedWorkspace.id];
  //     if (workspaceUploads) {
  //       return workspaceUploads.find((u) => u.id === selectedId);
  //     }
  //     return null;
  //   }
  // }, [selectedId, selectedWorkspace, uploads]);

  return (
    <>
      {contextHolder}
      <Modal
        open={isPreviewModalOpen}
        title="Content Preview"
        width={'90%'}
        bodyStyle={{ height: 500, overflowY: 'auto' }}
        onCancel={onPreviewCancel}
        onOk={onPreviewCancel}
      >
        {/* <ContentView upload={upload} /> */}
        <DataSourceContentView dataSource={dataSource} />
      </Modal>
      <IndexModal
        ext={dataSource?.documentType}
        isDataSource={true}
        onCancel={onIndexCancel}
        onSubmit={onIndexSubmit}
        open={isIndexModalOpen}
      />
      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
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
