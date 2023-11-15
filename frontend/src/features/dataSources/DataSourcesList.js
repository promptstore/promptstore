import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Modal, Space, Table, Tag, message } from 'antd';
import useLocalStorageState from 'use-local-storage-state';

// import { DataSourceContentView } from '../../components/DataSourceContentView';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { getColor } from '../../utils';

import { IndexModal } from '../uploader/IndexModal';
import {
  crawlAsync,
  getUploadsAsync,
  indexApiAsync,
  indexCsvAsync,
  indexGraphAsync,
  indexDocumentAsync,
  indexTextDocumentAsync,
  indexWikipediaAsync,
  selectLoaded as selectUploadsLoaded,
  selectIndexed,
  selectIndexing,
} from '../uploader/fileUploaderSlice';

import {
  deleteDataSourcesAsync,
  getDataSourcesAsync,
  // getDataSourceContentAsync,
  selectDataSources,
  selectLoading,
} from './dataSourcesSlice';

const indexableTypes = ['api', 'crawler', 'graphstore', 'wikipedia'];

export function DataSourcesList() {

  // const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isIndexModalOpen, setIsIndexModalOpen] = useState(false);
  const [page, setPage] = useLocalStorageState('data-sources-list-page', { defaultValue: 1 });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const dataSources = useSelector(selectDataSources);
  const loading = useSelector(selectLoading);
  const uploadsLoaded = useSelector(selectUploadsLoaded);
  const indexed = useSelector(selectIndexed);
  const indexing = useSelector(selectIndexing);

  const data = useMemo(() => {
    const list = Object.values(dataSources).map((ds) => ({
      key: ds.id,
      name: ds.name,
      type: ds.type,
      instance: ds.featurestore || ds.documentType || ds.dialect || ds.graphstore,
      documentId: ds.documentId,
      documents: ds.documents,
      baseUrl: ds.baseUrl,
      scrapingSpec: ds.scrapingSpec,
      maxRequestsPerCrawl: ds.maxRequestsPerCrawl,
      indexId: ds.indexId,
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
    if (location.state?.message) {
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
      dispatch(getUploadsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (selectedId && indexed?.[selectedId]) {
      messageApi.info({
        content: 'Finished indexing ' + dataSource.name,
        duration: 3,
      });
      setSelectedId(null);
    }
  }, [indexed, selectedId]);

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
    if (dataSource.type === 'api') {
      dispatch(indexApiAsync({
        dataSourceId: dataSource.id,
        params: {
          indexId: values.indexId,
          newIndexName: values.newIndexName,
          embeddingProvider: values.embeddingProvider,
          vectorStoreProvider: values.vectorStoreProvider,
          graphStoreProvider: values.graphStoreProvider,
          allowedNodes: values.allowedNodes,
          allowedRels: values.allowedRels,
          endpoint: dataSource.endpoint,
          schema: dataSource.schema,
        },
        workspaceId: selectedWorkspace.id,
      }));

    } else if (dataSource.type === 'crawler') {
      dispatch(crawlAsync({
        dataSourceId: dataSource.id,
        params: {
          indexId: values.indexId,
          newIndexName: values.newIndexName,
          embeddingProvider: values.embeddingProvider,
          vectorStoreProvider: values.vectorStoreProvider,
          graphStoreProvider: values.graphStoreProvider,
          allowedNodes: values.allowedNodes,
          allowedRels: values.allowedRels,
          dataSourceName: dataSource.name,
          url: dataSource.baseUrl,
          crawlerSpec: dataSource.scrapingSpec,
          maxRequestsPerCrawl: parseInt(dataSource.maxRequestsPerCrawl || '99', 10),
          chunkElement: dataSource.chunkElement,
        },
        workspaceId: selectedWorkspace.id,
      }));

    } else if (dataSource.type === 'document') {
      if (dataSource.documentType === 'csv') {
        dispatch(indexCsvAsync({
          dataSourceId: dataSource.id,
          documents: dataSource.documents,
          params: {
            indexId: values.indexId,
            newIndexName: values.newIndexName,
            embeddingProvider: values.embeddingProvider,
            vectorStoreProvider: values.vectorStoreProvider,
            graphStoreProvider: values.graphStoreProvider,
            allowedNodes: values.allowedNodes,
            allowedRels: values.allowedRels,
            delimiter: dataSource.delimiter,
            quoteChar: dataSource.quoteChar,
          },
          workspaceId: selectedWorkspace.id,
        }));
      } else if (dataSource.documentType === 'txt') {
        dispatch(indexTextDocumentAsync({
          dataSourceId: dataSource.id,
          documents: dataSource.documents,
          params: {
            indexId: values.indexId,
            newIndexName: values.newIndexName,
            embeddingProvider: values.embeddingProvider,
            vectorStoreProvider: values.vectorStoreProvider,
            graphStoreProvider: values.graphStoreProvider,
            allowedNodes: values.allowedNodes,
            allowedRels: values.allowedRels,
            splitter: dataSource.splitter,
            characters: dataSource.characters,
            functionId: dataSource.functionId,
            chunkSize: +dataSource.chunkSize,
            chunkOverlap: +dataSource.chunkOverlap,
          },
          workspaceId: selectedWorkspace.id,
        }));
      } else {
        dispatch(indexDocumentAsync({
          dataSourceId: dataSource.id,
          documents: dataSource.documents,
          params: {
            indexId: values.indexId,
            newIndexName: values.newIndexName,
            embeddingProvider: values.embeddingProvider,
            vectorStoreProvider: values.vectorStoreProvider,
            graphStoreProvider: values.graphStoreProvider,
            allowedNodes: values.allowedNodes,
            allowedRels: values.allowedRels,
          },
          workspaceId: selectedWorkspace.id,
        }));
      }
    } else if (dataSource.type === 'graphstore') {
      dispatch(indexGraphAsync({
        dataSourceId: dataSource.id,
        params: {
          indexId: values.indexId,
          newIndexName: values.newIndexName,
          graphstore: dataSource.graphstore,
          embeddingProvider: values.embeddingProvider,
          vectorStoreProvider: values.vectorStoreProvider,
          graphStoreProvider: values.graphStoreProvider,
          allowedNodes: values.allowedNodes,
          allowedRels: values.allowedRels,
          nodeLabel: dataSource.nodeLabel,
          embeddingNodeProperty: dataSource.embeddingNodeProperty,
          textNodeProperties: dataSource.textNodeProperties,
          sourceIndexId: dataSource.indexId,
        },
        workspaceId: selectedWorkspace.id,
      }));
    } else if (dataSource.type === 'wikipedia') {
      dispatch(indexWikipediaAsync({
        dataSourceId: dataSource.id,
        params: {
          indexId: values.indexId,
          newIndexName: values.newIndexName,
          embeddingProvider: values.embeddingProvider,
          vectorStoreProvider: values.vectorStoreProvider,
          graphStoreProvider: values.graphStoreProvider,
          allowedNodes: values.allowedNodes,
          allowedRels: values.allowedRels,
          query: dataSource.query,
          splitter: dataSource.splitter,
          characters: dataSource.characters,
          functionId: dataSource.functionId,
          chunkSize: +dataSource.chunkSize,
          chunkOverlap: +dataSource.chunkOverlap,
        },
        workspaceId: selectedWorkspace.id,
      }));
    }
    setIsIndexModalOpen(false);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const openIndex = (record) => {
    setSelectedId(record.key);
    setIsIndexModalOpen(true);
  };

  // const onPreviewCancel = () => {
  //   setIsPreviewModalOpen(false);
  //   setSelectedId(null);
  // };

  // const openPreview = (record) => {
  //   setSelectedId(record.key);
  //   dispatch(getDataSourceContentAsync(record.key, 1000 * 1024)); // preview 1Mb
  //   setIsPreviewModalOpen(true);
  // };

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
                loading={indexing[record.key]}
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
          {indexableTypes.includes(record.type) ?
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

  return (
    <>
      {contextHolder}
      {/* <Modal
        open={isPreviewModalOpen}
        title="Content Preview"
        width={'75%'}
        bodyStyle={{ height: 500, overflowY: 'auto' }}
        onCancel={onPreviewCancel}
        onOk={onPreviewCancel}
      >
        <DataSourceContentView dataSource={dataSource} />
      </Modal> */}
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
            onChange: (page) => setPage(page),
          }}
        />
      </div>
    </>
  );
};
