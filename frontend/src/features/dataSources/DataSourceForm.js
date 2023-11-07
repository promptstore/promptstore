import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Divider, Form, Input, Radio, Select, Space, Switch } from 'antd';

import { SchemaModalInput } from '../../components/SchemaModalInput';
import { TagsInput } from '../../components/TagsInput';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getFunctionsByTagAsync,
  selectFunctions,
  selectLoading as selectFunctionsLoading,
} from '../functions/functionsSlice';
import {
  getUploadsAsync,
  selectLoading as selectUploadsLoading,
  selectUploads,
} from '../uploader/fileUploaderSlice';

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
    label: 'Graph Store',
    value: 'graphstore',
  },
  {
    label: 'SQL',
    value: 'sql',
  },
  {
    label: 'Web Crawler',
    value: 'crawler',
  },
];

export function DataSourceForm() {

  const [backOnSave, setBackOnSave] = useState(false);

  const dataSources = useSelector(selectDataSources);
  const dialects = useSelector(selectDialects);
  const functions = useSelector(selectFunctions);
  const functionsLoading = useSelector(selectFunctionsLoading);
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

  const functionOptions = useMemo(() => Object.values(functions).map((func) => ({
    label: func.name,
    value: func.id,
  })), [functions]);

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
      dispatch(getFunctionsByTagAsync({ tag: 'chunker', workspaceId }));
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
        {typeValue === 'document' ?
          <>
            <Form.Item
              label="Document Type"
              name="documentType"
              wrapperCol={{ span: 10 }}
            >
              <Select options={documentTypeOptions} optionFilterProp="label" />
            </Form.Item>
            <Form.Item
              label="Documents"
              name="documents"
              wrapperCol={{ span: 10 }}
            >
              <Select allowClear
                loading={uploadsLoading}
                mode="multiple"
                options={documentOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item
              label="Extract Metadata"
            >
              <Form.Item
                name="extractMetadata"
                valuePropName="checked"
                style={{ display: 'inline-block', margin: 0 }}
              >
                <Switch />
              </Form.Item>
              {extractMetadataValue ?
                <Form.Item
                  label="Schema"
                  name="extractSchema"
                  style={{ display: 'inline-block', margin: '0 0 0 16px' }}
                >
                  <SchemaModalInput />
                </Form.Item>
                : null
              }
            </Form.Item>
          </>
          : null
        }
        {documentTypeValue === 'csv' ?
          <>
            <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
              <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                CSV Parameters
              </div>
            </Form.Item>
            <Form.Item
              label="Delimiter"
              name="delimiter"
              initialValue=","
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Quote Char"
              name="quoteChar"
              initialValue={'"'}
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
          </>
          : null
        }
        {documentTypeValue === 'txt' ?
          <>
            <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
              <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                Text File Parameters
              </div>
            </Form.Item>
            {/* <Form.Item
              label="Text Property"
              name="textProperty"
              initialValue="text"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item> */}
            <Form.Item
              label="Split by"
              name="splitter"
              wrapperCol={{ span: 10 }}
            >
              <Select allowClear
                options={splitterOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            {splitterValue === 'delimiter' ?
              <Form.Item
                label="Character(s)"
                name="characters"
                initialValue="\n\n"
                wrapperCol={{ span: 10 }}
              >
                <Input />
              </Form.Item>
              : null
            }
            {splitterValue === 'chunker' ?
              <Form.Item
                label="Chunker"
                name="functionId"
                wrapperCol={{ span: 10 }}
              >
                <Select allowClear
                  loading={functionsLoading}
                  options={functionOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {splitterValue === 'token' ?
              <>
                <Form.Item
                  label="Chunk Size"
                  name="chunkSize"
                  initialValue="2048"
                  wrapperCol={{ span: 5 }}
                >
                  <Input type="number" />
                </Form.Item>
                <Form.Item
                  label="Chunk Overlap"
                  name="chunkOverlap"
                  initialValue="24"
                  wrapperCol={{ span: 5 }}
                >
                  <Input type="number" />
                </Form.Item>
              </>
              : null
            }
          </>
          : null
        }
        {typeValue === 'featurestore' ?
          <>
            <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
              <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                Feature Store Connection Info
              </div>
            </Form.Item>
            <Form.Item
              label="Feature Store"
              name="featurestore"
              wrapperCol={{ span: 10 }}
            >
              <Select options={featurestoreOptions} optionFilterProp="label" />
            </Form.Item>
            <Form.Item
              label="HTTP Method"
              name="httpMethod"
              wrapperCol={{ span: 10 }}
            >
              <Radio.Group
                options={httpMethodOptions}
                optionType="button"
                buttonStyle="solid"
              />
            </Form.Item>
            <Form.Item
              label="URL"
              name="url"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Parameter Schema"
              name="parameterSchema"
            >
              <SchemaModalInput />
            </Form.Item>
            <Form.Item
              label="Credentials"
              wrapperCol={{ span: 10 }}
            >
              <Form.Item
                label="Key"
                name="appId"
                colon={false}
                style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Secret"
                name="appSecret"
                colon={false}
                style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
              >
                <Input type="password" />
              </Form.Item>
            </Form.Item>
          </>
          : null
        }
        {featurestoreValue === 'feast' ?
          <>
            <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
              <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                Feast Parameters
              </div>
            </Form.Item>
            <Form.Item
              label="Feature Service"
              name="featureService"
              extra="Takes precedence over the feature list"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
            <Form.Item wrapperCol={{ offset: 4, span: 10 }} style={{ margin: '-24px 0 0' }}>
              <Divider orientation="left" style={{ color: 'rgba(0,0,0,0.45)' }}>or</Divider>
            </Form.Item>
            <Form.Item
              label="Feature List"
              name="featureList"
              extra="Enter a comma-separated list"
              wrapperCol={{ span: 10 }}
            >
              <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
            </Form.Item>
            <Form.Item
              label="Entity"
              name="entity"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
          </>
          : null
        }
        {featurestoreValue === 'anaml' ?
          <>
            <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
              <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                Anaml Parameters
              </div>
            </Form.Item>
            <Form.Item
              label="Feature Store Name"
              name="featureStoreName"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
          </>
          : null
        }
        {typeValue === 'graphstore' ?
          <>
            <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
              <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                Graph Store Connection Info
              </div>
            </Form.Item>
            <Form.Item
              label="Graph Store"
              name="graphstore"
              wrapperCol={{ span: 10 }}
            >
              <Select options={graphstoreOptions} optionFilterProp="label" />
            </Form.Item>
            {/* <Form.Item
              label="Host"
              name="host"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Credentials"
              wrapperCol={{ span: 10 }}
            >
              <Form.Item
                label="Username"
                name="uaername"
                colon={false}
                style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Password"
                name="password"
                colon={false}
                style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
              >
                <Input type="password" />
              </Form.Item>
            </Form.Item> */}
          </>
          : null
        }
        {graphstoreValue === 'neo4j' ?
          <>
            <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
              <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                Neo4j Parameters
              </div>
            </Form.Item>
            <Form.Item
              label="Node Label"
              name="nodeLabel"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Embedding Node Property"
              name="embeddingNodeProperty"
              initialValue="embedding"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Text Node Properties"
              name="textNodeProperties"
            >
              <TagsInput />
            </Form.Item>
            <Form.Item
              label="Limit"
              name="limit"
              initialValue={1000}
              wrapperCol={{ span: 10 }}
            >
              <Input type="number" style={{ width: 100 }} />
            </Form.Item>
          </>
          : null
        }
        {typeValue === 'crawler' ?
          <>
            <Form.Item
              label="URL"
              name="baseUrl"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Maximum Requests"
              name="maxRequestsPerCrawl"
              wrapperCol={{ span: 5 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Scraping Spec"
              name="scrapingSpec"
              wrapperCol={{ span: 5 }}
            >
              <SchemaModalInput
                isSpec={true}
                title="Set Spec"
                placeholders={{
                  title: 'selector',
                  description: 'attribute (leave empty for text content)',
                }}
              />
            </Form.Item>
          </>
          : null
        }
        {typeValue === 'sql' ?
          <>
            <Form.Item
              label="Dialect"
              name="dialect"
              wrapperCol={{ span: 10 }}
            >
              <Select allowClear
                options={dialectOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item
              label="Metadata Source"
              name="sqlType"
            >
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={sqlTypeOptions}
              />
            </Form.Item>
            {dialectValue === 'postgresql' || dialectValue === 'bigquery' ?
              <>
                <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
                  <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                    Connection Info
                  </div>
                </Form.Item>
                {dialectValue === 'postgresql' ?
                  <Form.Item
                    label="Connection String"
                    name="connectionString"
                    wrapperCol={{ span: 10 }}
                  >
                    <Input />
                  </Form.Item>
                  : null
                }
                <Form.Item
                  label={dialectValue === 'bigquery' ? 'Dataset' : 'Schema'}
                  name="dataset"
                  wrapperCol={{ span: 10 }}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  extra="Enter a comma separated list"
                  label="Tables"
                  name="tables"
                  wrapperCol={{ span: 10 }}
                >
                  <Input />
                </Form.Item>
                {sqlTypeValue === 'sample' ?
                  <>
                    <Form.Item
                      label="Table"
                      name="tableName"
                      wrapperCol={{ span: 10 }}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      label="Sample Rows"
                      name="sampleRows"
                      wrapperCol={{ span: 2 }}
                    >
                      <Input type="number" />
                    </Form.Item>
                  </>
                  : null
                }
              </>
              : null
            }
            {dialectValue === 'clickhouse' ?
              <>
                <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
                  <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                    Connection Info
                  </div>
                </Form.Item>
                <Form.Item
                  label="Host"
                  name="databaseHost"
                  wrapperCol={{ span: 10 }}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Database"
                  name="databaseName"
                  wrapperCol={{ span: 10 }}
                >
                  <Input />
                </Form.Item>
                {sqlTypeValue === 'sample' ?
                  <>
                    <Form.Item
                      label="Table"
                      name="tableName"
                      wrapperCol={{ span: 10 }}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      label="Sample Rows"
                      name="sampleRows"
                      wrapperCol={{ span: 2 }}
                    >
                      <Input type="number" />
                    </Form.Item>
                  </>
                  : null
                }
                <Form.Item
                  label="Credentials"
                  name="credentials"
                  wrapperCol={{ span: 10 }}
                >
                  <Form.Item
                    label="Username"
                    name={['credentials', 'username']}
                    colon={false}
                    style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    label="Password"
                    name={['credentials', 'password']}
                    colon={false}
                    style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
                  >
                    <Input type="password" />
                  </Form.Item>
                </Form.Item>
              </>
              : null
            }
          </>
          : null
        }
        {typeValue === 'api' ?
          <>
            <Form.Item
              label="Endpoint"
              name="endpoint"
              wrapperCol={{ span: 10 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Schema"
              name="schema"
            >
              <SchemaModalInput />
            </Form.Item>
          </>
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
