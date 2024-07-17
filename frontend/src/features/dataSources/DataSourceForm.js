import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Select, Space } from 'antd';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getFunctionsByTagsAsync,
  selectFunctions,
  selectLoading as selectFunctionsLoading,
} from '../functions/functionsSlice';
import {
  getIndexesAsync,
  selectIndexes,
  selectLoading as selectIndexesLoading,
} from '../indexes/indexesSlice';
import {
  getUploadsAsync,
  selectLoading as selectUploadsLoading,
  selectUploads,
} from '../uploader/fileUploaderSlice';

import { APIFormFields } from './APIFormFields';
import { AnamlFormFields } from './AnamlFormFields';
import { CSVFormFields } from './CSVFormFields';
import { CrawlerFormFields } from './CrawlerFormFields';
import { DocumentFormFields } from './DocumentFormFields';
import { FeastFormFields } from './FeastFormFields';
import { FeatureStoreFormFields } from './FeatureStoreFormFields';
import { FolderFormFields } from './FolderFormFields';
import { GraphStoreFormFields } from './GraphStoreFormFields';
import { MetricStoreFormFields } from './MetricStoreFormFields';
import { Neo4jFormFields } from './Neo4jFormFields';
import { SQLFormFields } from './SQLFormFields';
import { TextDocumentFormFields } from './TextDocumentFormFields';
import { WikipediaFormFields } from './WikipediaFormFields';
import {
  createDataSourceAsync,
  getDataSourceAsync,
  getDialectsAsync,
  selectDataSources,
  selectDialects,
  selectLoaded,
  updateDataSourceAsync,
} from './dataSourcesSlice';

const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const documentTypeOptions = [
  {
    label: 'CSV',
    value: 'csv',
  },
  {
    label: 'EPUB',
    value: 'epub',
  },
  {
    label: 'Electronic Mail Format',
    value: 'eml',
  },
  {
    label: 'Excel (OpenXML)',
    value: 'xlsx',
  },
  {
    label: 'HTML',
    value: 'html',
  },
  {
    label: 'JSON',
    value: 'json',
  },
  {
    label: 'Markdown',
    value: 'md',
  },
  {
    label: 'Microsoft Word',
    value: 'doc',
  },
  {
    label: 'Microsoft Word (OpenXML)',
    value: 'docx',
  },
  {
    label: 'OpenDocument Text',
    value: 'odt',
  },
  {
    label: 'Outlook Message',
    value: 'msg',
  },
  {
    label: 'PDF',
    value: 'pdf',
  },
  {
    label: 'Powerpoint',
    value: 'ppt',
  },
  {
    label: 'Powerpoint (OpenXML)',
    value: 'pptx',
  },
  {
    label: 'reStructuredText',
    value: 'rst',
  },
  {
    label: 'Rich Text Format',
    value: 'rtf',
  },
  {
    label: 'TSV',
    value: 'tsv',
  },
  {
    label: 'Text',
    value: 'txt',
  },
  {
    label: 'XML',
    value: 'xml',
  },
];

const featurestoreOptions = [
  {
    label: 'Anaml',
    value: 'anaml',
  },
  {
    label: 'Feast',
    value: 'feast',
  },
  {
    label: 'Vertex',
    value: 'vertex',
  },
];

const graphstoreOptions = [
  {
    label: 'Neo4j',
    value: 'neo4j',
  },
];

const httpMethodOptions = [
  {
    label: 'GET',
    value: 'get',
  },
  {
    label: 'POST',
    value: 'post',
  },
];

const metricstoreOptions = [
  {
    label: 'MetricFlow',
    value: 'metricflow',
  },
];

const splitterOptions = [
  {
    label: 'Delimiter',
    value: 'delimiter',
  },
  {
    label: 'Token',
    value: 'token',
  },
  {
    label: 'Chunking Function',
    value: 'chunker',
  },
];

const sqlTypeOptions = [
  {
    label: 'Sample',
    value: 'sample',
  },
  {
    label: 'Schema',
    value: 'schema',
  },
];

const typeOptions = [
  {
    label: 'API',
    value: 'api',
  },
  {
    label: 'Document',
    value: 'document',
  },
  {
    label: 'Feature Store',
    value: 'featurestore',
  },
  {
    label: 'Folder',
    value: 'folder',
  },
  {
    label: 'Knowledge Graph',
    value: 'graphstore',
  },
  {
    label: 'Metrics Store',
    value: 'metricstore',
  },
  {
    label: 'SQL',
    value: 'sql',
  },
  {
    label: 'Web Crawler',
    value: 'crawler',
  },
  {
    label: 'Wikipedia',
    value: 'wikipedia',
  },
];

export function DataSourceForm() {

  const [backOnSave, setBackOnSave] = useState(false);

  const dataSources = useSelector(selectDataSources);
  const dialects = useSelector(selectDialects);
  const functions = useSelector(selectFunctions);
  const functionsLoading = useSelector(selectFunctionsLoading);
  const indexes = useSelector(selectIndexes);
  const indexesLoading = useSelector(selectIndexesLoading);
  const loaded = useSelector(selectLoaded);
  const uploads = useSelector(selectUploads);
  const uploadsLoading = useSelector(selectUploadsLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const typeValue = Form.useWatch('type', form);
  const documentTypeValue = Form.useWatch('documentType', form);
  const splitterValue = Form.useWatch('splitter', form);
  const featurestoreValue = Form.useWatch('featurestore', form);
  const graphstoreValue = Form.useWatch('graphstore', form);
  const extractMetadataValue = Form.useWatch('extractMetadata', form);
  const dialectValue = Form.useWatch('dialect', form);
  const sqlTypeValue = Form.useWatch('sqlType', form);

  const id = location.pathname.match(/\/data-sources\/(.*)/)[1];
  const dataSource = dataSources[id];
  const isNew = id === 'new';

  // console.log('dataSource:', dataSource);

  const dialectOptions = useMemo(() => {
    const list = dialects.map((d) => ({
      label: d.name,
      value: d.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [dialects]);

  const documentOptions = useMemo(() => {
    if (selectedWorkspace) {
      const workspaceUploads = uploads[selectedWorkspace.id];
      if (workspaceUploads) {
        return Object.values(workspaceUploads)
          .map((doc) => ({
            label: doc.name,
            value: doc.id,
          }));
      }
    }
  }, [selectedWorkspace, uploads, documentTypeValue]);

  const chunkerFunctionOptions = useMemo(() => Object.values(functions)
    .filter((func) => func.tags?.includes('chunker'))
    .map((func) => ({
      label: func.name,
      value: func.id,
    })), [functions]);

  const rephraseFunctionOptions = useMemo(() => Object.values(functions)
    .filter((func) => func.tags?.includes('rephrase'))
    .map((func) => ({
      label: func.name,
      value: func.id,
    })), [functions]);

  const indexOptions = useMemo(() => Object.values(indexes).map((index) => ({
    label: index.name,
    value: index.id,
  })), [indexes]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Data Source',
    }));
    dispatch(getDialectsAsync());
    if (!isNew) {
      dispatch(getDataSourceAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getFunctionsByTagsAsync({ tags: ['chunker', 'rephrase'], workspaceId }));
      dispatch(getIndexesAsync({ workspaceId }));
      dispatch(getUploadsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (backOnSave) {
      setBackOnSave(false);
      navigate('/data-sources');
    }
  }, [dataSources]);

  const onCancel = () => {
    navigate('/data-sources');
  };

  const onFinish = (values) => {
    if (isNew) {
      dispatch(createDataSourceAsync({
        values: {
          ...values,
          workspaceId: selectedWorkspace.id,
          chunkSize: +values.chunkSize,
          chunkOverlap: +values.chunkOverlap,
        },
      }));
    } else {
      dispatch(updateDataSourceAsync({
        id,
        values: {
          ...dataSource,
          ...values,
          chunkSize: +values.chunkSize,
          chunkOverlap: +values.chunkOverlap,
        },
      }));
    }
    setBackOnSave(true);
  };

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <div style={{ marginTop: 20 }}>
      <Form
        {...layout}
        form={form}
        name="dataSource"
        autoComplete="off"
        onFinish={onFinish}
        initialValues={dataSource}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            {
              required: true,
              message: 'Please enter a data source name',
            },
          ]}
          wrapperCol={{ span: 14 }}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Description"
          name="description"
          wrapperCol={{ span: 14 }}
        >
          <TextArea autoSize={{ minRows: 3, maxRows: 14 }} />
        </Form.Item>
        <Form.Item
          label="Type"
          name="type"
          rules={[
            {
              required: true,
              message: 'Please select the type',
            },
          ]}
          wrapperCol={{ span: 10 }}
        >
          <Select options={typeOptions} optionFilterProp="label" />
        </Form.Item>
        {typeValue === 'wikipedia' ?
          <WikipediaFormFields />
          : null
        }
        {typeValue === 'folder' ?
          <FolderFormFields />
          : null
        }
        {typeValue === 'document' ?
          <DocumentFormFields
            documentTypeOptions={documentTypeOptions}
            documentOptions={documentOptions}
            extractMetadataValue={extractMetadataValue}
            uploadsLoading={uploadsLoading}
          />
          : null
        }
        {documentTypeValue === 'csv' ?
          <CSVFormFields />
          : null
        }
        {documentTypeValue === 'txt' || typeValue === 'wikipedia' ?
          <TextDocumentFormFields
            chunkerFunctionOptions={chunkerFunctionOptions}
            functionsLoading={functionsLoading}
            rephraseFunctionOptions={rephraseFunctionOptions}
            splitterOptions={splitterOptions}
            splitterValue={splitterValue}
          />
          : null
        }
        {typeValue === 'featurestore' ?
          <FeatureStoreFormFields
            featurestoreOptions={featurestoreOptions}
            httpMethodOptions={httpMethodOptions}
          />
          : null
        }
        {featurestoreValue === 'feast' ?
          <FeastFormFields />
          : null
        }
        {featurestoreValue === 'anaml' ?
          <AnamlFormFields />
          : null
        }
        {typeValue === 'graphstore' ?
          <GraphStoreFormFields
            graphstoreOptions={graphstoreOptions}
          />
          : null
        }
        {typeValue === 'metricstore' ?
          <MetricStoreFormFields
            metricstoreOptions={metricstoreOptions}
            httpMethodOptions={httpMethodOptions}
          />
          : null
        }
        {graphstoreValue === 'neo4j' ?
          <Neo4jFormFields
            indexesLoading={indexesLoading}
            indexOptions={indexOptions}
          />
          : null
        }
        {typeValue === 'crawler' ?
          <CrawlerFormFields />
          : null
        }
        {typeValue === 'sql' ?
          <SQLFormFields
            dialectOptions={dialectOptions}
            dialectValue={dialectValue}
            sqlTypeOptions={sqlTypeOptions}
            sqlTypeValue={sqlTypeValue}
          />
          : null
        }
        {typeValue === 'api' ?
          <APIFormFields />
          : null
        }
        <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
          <Space>
            <Button type="default" onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
