import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Modal, Space, Table, Tag, message } from 'antd';
import useLocalStorageState from 'use-local-storage-state';

// import { ContentView } from '../../components/ContentView';
import { DataSourceContentView } from '../../components/DataSourceContentView';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { IndexModal } from '../uploader/IndexModal';
import {
  // getUploadContentAsync,
  getUploadsAsync,
  indexApiAsync,
  indexStructuredDocumentAsync,
  indexDocumentAsync,
  selectLoaded as selectUploadsLoaded,
  selectUploads,
} from '../uploader/fileUploaderSlice';

import {
  crawlAsync,
  deleteDataSourcesAsync,
  getDataSourcesAsync,
  getDataSourceContentAsync,
  selectDataSources,
  selectLoading,
} from './dataSourcesSlice';

export function DataSourcesList() {

  const [isIndexModalOpen, setIsIndexModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [page, setPage] = useLocalStorageState('data-sources-list-page', 1);
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
      instance: ds.featurestore || ds.documentType || ds.dialect,
      documentId: ds.documentId,
      documents: ds.documents,
      baseUrl: ds.baseUrl,
      scrapingSpec: ds.scrapingSpec,
      maxRequestsPerCrawl: ds.maxRequestsPerCrawl,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [dataSources]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const dataSource = dataSources[selectedId];

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/data-sources/new',
      title: 'Data Sources',
    }));
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
      const workspaceId = selectedWorkspace.id;
      dispatch(getDataSourcesAsync({ workspaceId }));
      dispatch(getUploadsAsync({ sourceId: workspaceId }));
    }
  }, [selectedWorkspace]);

  // useEffect(() => {
  //   if (selectedId && selectedWorkspace) {
  //     dispatch(getUploadContentAsync(selectedWorkspace.id, selectedId, 1000 * 1024)); // preview 1Mb
  //   }
  // }, [selectedId, selectedWorkspace]);
  // useEffect(() => {
  //   if (selectedId) {
  //     dispatch(getDataSourceContentAsync(selectedId, 1000 * 1024)); // preview 1Mb
  //   }
  // }, [selectedId]);

  const onDelete = () => {
    dispatch(deleteDataSourcesAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onIndexCancel = () => {
    setIsIndexModalOpen(false);
  };

  const onIndexSubmit = (values) => {
    if (dataSource.type === 'crawler') {
      dispatch(crawlAsync({
        url: dataSource.baseUrl,
        spec: dataSource.scrapingSpec,
        maxRequestsPerCrawl: parseInt(dataSource.maxRequestsPerCrawl || '99', 10),
        indexId: values.indexId,
        newIndexName: values.newIndexName,
        engine: values.engine,
        titleField: values.titleField,
        vectorField: values.vectorField,
        workspaceId: selectedWorkspace.id,
      }));

    } else if (dataSource.type === 'api') {
      dispatch(indexApiAsync({
        endpoint: dataSource.endpoint,
        schema: dataSource.schema,
        params: {
          indexId: values.indexId,
          newIndexName: values.newIndexName,
          engine: values.engine,
          vectorField: values.vectorField,
        },
        workspaceId: selectedWorkspace.id,
      }));

    } else if (dataSource.type === 'document') {

      dispatch(indexStructuredDocumentAsync({
        documents: dataSource.documents,
        params: {
          indexId: values.indexId,
          newIndexName: values.newIndexName,
          engine: values.engine,
        },
        workspaceId: selectedWorkspace.id,
      }));

      // sources can now have more than one document
      /*
      const workspaceUploads = uploads[selectedWorkspace.id];
      const upload = workspaceUploads.find((doc) => doc.id === dataSource.documentId);
      // console.log('upload:', upload);

      if (upload) {

        if (dataSource.documentType === 'csv') {
          dispatch(indexDocumentAsync({
            filepath: upload.name,
            params: {
              ...values,
              documentId: dataSource.documentId,
              delimiter: dataSource.delimiter,
              quoteChar: dataSource.quoteChar,
              titleField: values.titleField,
              vectorField: values.vectorField,
            },
          }));

        } else if (dataSource.documentType === 'txt') {
          // console.log('dataSource:', dataSource);
          dispatch(indexDocumentAsync({
            filepath: upload.name,
            params: {
              ...values,
              documentId: dataSource.documentId,
              textProperty: dataSource.textProperty,
              splitter: dataSource.splitter,
              characters: dataSource.characters,
              functionId: dataSource.functionId,
            },
          }));

        } else if (
          dataSource.documentType === 'pdf' ||
          dataSource.documentType === 'docx'
        ) {
          dispatch(indexStructuredDocumentAsync({
            uploadId: upload.id,
            params: {
              indexId: values.indexId,
              newIndexName: values.newIndexName,
              engine: values.engine,
            },
          }));
        }
      }
      */
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

  // const openCrawl = (record) => {
  //   dispatch(crawlAsync({
  //     url: record.baseUrl,
  //     spec: record.scrapingSpec,
  //     maxRequestsPerCrawl: parseInt(record.maxRequestsPerCrawl || '99', 10),
  //   }));
  // };

  const openIndex = (record) => {
    setSelectedId(record.key);
    setIsIndexModalOpen(true);
  };

  const openPreview = (record) => {
    // setSelectedId(record.documentId);
    setSelectedId(record.key);
    dispatch(getDataSourceContentAsync(record.key, 1000 * 1024)); // preview 1Mb
    setIsPreviewModalOpen(true);
  };

  const getColor = (instance) => {
    switch (instance) {
      case 'feast':
        return '#87d068';

      case 'anaml':
        return '#2db7f5';

      case 'postgresql':
        return '#ca3dd4';

      default:
        return 'rgba(0, 0, 0, 0.25)';
    }
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
      title: 'Source Type',
      dataIndex: 'type',
      render: (_, { type }) => (
        <Tag>{type}</Tag>
      )
    },
    {
      title: 'Instance Type',
      dataIndex: 'instance',
      width: '100%',
      render: (_, { instance }) => (
        <Tag color={getColor(instance)}>{instance}</Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/data-sources/${record.key}`)}
          >
            Edit
          </Button>
          {record.type === 'document' && record.documents ?
            <>
              <Button type="link"
                disabled={!uploadsLoaded}
                style={{ paddingLeft: 0 }}
                onClick={() => openIndex(record)}
              >
                Index
              </Button>
              {/* <Button type="link"
                style={{ paddingLeft: 0 }}
                onClick={() => openPreview(record)}
              >
                Preview
              </Button> */}
            </>
            : null
          }
          {record.type === 'crawler' || record.type === 'api' ?
            <Button type="link"
              disabled={false}
              style={{ paddingLeft: 0 }}
              onClick={() => openIndex(record)}
            >
              Index
            </Button>
            : null
          }
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
        type={dataSource?.type}
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
