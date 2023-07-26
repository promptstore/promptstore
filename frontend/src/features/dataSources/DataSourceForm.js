import { useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Divider, Form, Input, Radio, Select, Space, Switch } from 'antd';

import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import { SchemaModalInput } from '../../components/SchemaModalInput';
import { getExtension } from '../../utils';
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
  updateDataSourceAsync,
  selectLoaded,
  selectDataSources,
} from './dataSourcesSlice';

const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const databaseOptions = [
  {
    label: 'PostgreSQL',
    value: 'postgresql',
  },
];

const documentTypeOptions = [
  {
    label: 'CSV',
    value: 'csv',
  },
  {
    label: 'Microsoft Word',
    value: 'docx',
  },
  {
    label: 'PDF',
    value: 'pdf',
  },
  {
    label: 'Text',
    value: 'txt',
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
    label: 'SQL',
    value: 'sql',
  },
  {
    label: 'Web Crawler',
    value: 'crawler',
  },
];

export function DataSourceForm() {

  const dataSources = useSelector(selectDataSources);
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

  const id = location.pathname.match(/\/data-sources\/(.*)/)[1];
  const dataSource = dataSources[id];
  const isNew = id === 'new';

  const documentOptions = useMemo(() => {
    if (selectedWorkspace) {
      const workspaceUploads = uploads[selectedWorkspace.id];
      if (workspaceUploads) {
        return Object.values(workspaceUploads)
          .filter((doc) => getExtension(doc.name) === documentTypeValue)
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
    dispatch(getFunctionsByTagAsync({ tag: 'chunker' }));
    if (!isNew) {
      dispatch(getDataSourceAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getUploadsAsync({ sourceId: selectedWorkspace.id }));
    }
  }, [selectedWorkspace]);

  const onCancel = () => {
    navigate('/data-sources');
  };

  const onFinish = (values) => {
    // console.log('values:', values);
    if (isNew) {
      dispatch(createDataSourceAsync({ values }));
    } else {
      dispatch(updateDataSourceAsync({
        id,
        values: {
          ...dataSource,
          ...values,
        },
      }));
    }
    navigate('/data-sources');
  };

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
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
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Description"
            name="description"
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
                label="Document"
                name="documentId"
                wrapperCol={{ span: 10 }}
              >
                <Select allowClear
                  loading={uploadsLoading}
                  options={documentOptions}
                  optionFilterProp="label"
                />
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
              <Form.Item
                label="Text Property"
                name="textProperty"
                initialValue="text"
                wrapperCol={{ span: 10 }}
              >
                <Input />
              </Form.Item>
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
              <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
                <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                  SQL Connection Info
                </div>
              </Form.Item>
              <Form.Item
                label="Dialect"
                name="dialect"
                wrapperCol={{ span: 10 }}
              >
                <Select allowClear options={databaseOptions} optionFilterProp="label" />
              </Form.Item>
              <Form.Item
                label="SQL Type"
                name="sqlType"
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={sqlTypeOptions}
                />
              </Form.Item>
              <Form.Item
                label="Connection String"
                name="connectionString"
                wrapperCol={{ span: 10 }}
              >
                <Input />
              </Form.Item>
              {/* <Form.Item
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
              </Form.Item> */}
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
    </>
  );
}
