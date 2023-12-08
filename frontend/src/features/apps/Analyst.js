import { useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Drawer, Layout, Space, Upload, message } from 'antd';
import { FileTextOutlined, LoadingOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import snakeCase from 'lodash.snakecase';
import { v4 as uuidv4 } from 'uuid';

import { Chat } from '../../components/Chat';
import {
  UserUploadsList,
} from '../../components/UserUploadsList';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  createDataSourceAsync,
  selectDataSources,
} from '../dataSources/dataSourcesSlice';
import {
  getFunctionResponseAsync as getChatResponseAsync,
  selectLoading as selectChatLoading,
  selectMessages,
  setMessages,
  selectTraceId,
  setTraceId,
} from '../designer/chatSlice';
import {
  indexDocumentAsync,
  selectIndexed,
  selectIndexing,
} from '../uploader/fileUploaderSlice';
import {
  getFunctionAsync,
  selectFunctions,
} from '../functions/functionsSlice';
import {
  fileUploadAsync,
  selectUploading,
  selectUploads,
} from './appUploaderSlice';
import {
  getAppAsync,
  selectLoaded,
  selectApps,
} from './appsSlice';

const { Content, Sider } = Layout;

export function Analyst() {

  const [correlationId, setCorrelationId] = useState({});
  const [open, setOpen] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState(null);

  const apps = useSelector(selectApps);
  const dataSources = useSelector(selectDataSources);
  const functions = useSelector(selectFunctions);
  const loaded = useSelector(selectLoaded);
  const messages = useSelector(selectMessages);
  const uploading = useSelector(selectUploading);
  const uploads = useSelector(selectUploads);
  const indexed = useSelector(selectIndexed);
  const indexing = useSelector(selectIndexing);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);
  const [messageApi, contextHolder] = message.useMessage();

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  // const id = location.pathname.match(/\/apps\/(.*)\/chat/)[1];
  const id = location.pathname.match(/\/apps\/(.*)\/analyst/)[1];
  const app = apps[id];
  const func = functions[app?.function];
  const sourceUploads = uploads[id] || [];
  const isIndexing = Object.values(indexing).some(v => v);

  // console.log('app:', app);
  // console.log('sourceUploads:', sourceUploads);
  // console.log('dataSources:', dataSources);

  useEffect(() => {
    dispatch(getAppAsync(id));
  }, []);

  useEffect(() => {
    if (app) {
      setNavbarState((state) => ({
        ...state,
        createLink: null,
        title: app?.name,
      }));
      dispatch(getFunctionAsync(app.function));
    }
  }, [app]);

  useEffect(() => {
    if (indexed) {
      dispatch(getAppAsync(id));
    }
  }, [indexed]);

  useEffect(() => {
    const upload = sourceUploads.find(u => u.filename === uploadedFilename);
    if (upload) {
      const { filename, id } = upload;
      createSource({ filename, id });
      setUploadedFilename(null);
    }
  }, [sourceUploads]);

  useEffect(() => {
    for (const source of Object.values(dataSources)) {
      const entry = Object.entries(correlationId)
        .find(([_, correlationId]) => correlationId === source.correlationId);
      if (entry) {
        const uploadId = entry[0];
        dispatch(indexDocumentAsync({
          appId: id,
          dataSourceId: source.id,
          documents: source.documents,
          params: {
            indexId: 'new',
            newIndexName: snakeCase(app.name),
            embeddingProvider: 'sentenceencoder',
            vectorStoreProvider: 'chroma',
          },
          workspaceId: selectedWorkspace.id,
        }));
        setCorrelationId((curr) => ({ ...curr, [uploadId]: null }));
      }
    }
  }, [dataSources]);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 3,
      });
    }
  }, [location]);

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
    dispatch(createDataSourceAsync({
      correlationId,
      appId: app.id,
      uploadId: id,
      values,
    }));
    setCorrelationId((curr) => ({
      ...curr,
      [id]: correlationId,
    }));
  };

  const handleChatSubmit = (values) => {
    const { messages } = values;
    const content = messages[messages.length - 1].content;
    let args = { content };
    dispatch(getChatResponseAsync({
      functionName: func.name,
      args,
      history: messages.slice(0, messages.length - 1),
      params: { maxTokens: 512 },
      workspaceId: selectedWorkspace.id,
      extraIndexes: app.indexes,
    }));
  };

  const handleChange = (info) => {
    if (info.file.status === 'uploading') {
      return;
    }
    if (info.file.status === 'done') {
      // console.log('info.file:', info.file);
      dispatch(fileUploadAsync(selectedWorkspace.id, app.id, info.file));
      setUploadedFilename(info.file.name);
    }
  };

  const openSettings = () => {
    navigate(`/apps-edit/${id}`);
  };

  const uploadButton = (
    <div>
      {uploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>
        {uploading ? 'Uploading...' : 'Upload'}
      </div>
    </div>
  );

  return (
    <>
      {contextHolder}
      <div style={{ height: '100%', marginTop: 20 }}>
        <Layout style={{ height: '100%' }}>
          <Content>
            <Chat
              messages={messages}
              onSubmit={handleChatSubmit}
              placeholder="Ask away..."
            />
          </Content>
          {app?.allowUpload ?
            <Drawer
              title="Documents"
              placement="right"
              closable={true}
              onClose={() => setOpen(false)}
              open={open}
              width={700}
            >
              <UserUploadsList
                loading={isIndexing}
                workspaceId={selectedWorkspace.id}
                appId={id}
              />
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <Upload
                  name="upload"
                  listType="picture-card"
                  className="avatar-uploader"
                  showUploadList={false}
                  customRequest={dummyRequest}
                  beforeUpload={beforeUpload}
                  onChange={handleChange}
                >
                  {uploadButton}
                </Upload>
              </div>
            </Drawer>
            : null
          }
          <Sider
            style={{ backgroundColor: 'inherit', marginLeft: 20 }}
          >
            <Space>
              <Button
                icon={<FileTextOutlined />}
                onClick={() => setOpen(true)}
              >Open</Button>
              <Button
                icon={<SettingOutlined />}
                onClick={openSettings}
              >Settings</Button>
            </Space>
          </Sider>
        </Layout>
      </div>
    </>
  );
}

const beforeUpload = (file) => {
  // console.log('file:', file);

  const isCSV = file.type === 'text/csv';

  const isText = file.type === 'text/plain';

  const isZip = file.type === 'application/zip';

  const isPdf = file.type === 'application/pdf';

  const isWord = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!(isCSV || isText || isZip || isPdf || isWord)) {
    message.error('You may only upload a CSV, Text or Zip file.');
  }

  const isLt2M = file.size / 1024 / 1024 < 1000;

  if (!isLt2M) {
    message.error('File must smaller than 1GB.');
  }

  return (isCSV || isText || isZip || isPdf || isWord) && isLt2M;
};

// https://stackoverflow.com/questions/51514757/action-function-is-required-with-antd-upload-control-but-i-dont-need-it
const dummyRequest = ({ file, onSuccess }) => {
  setTimeout(() => {
    onSuccess('ok');
  }, 20);
};
