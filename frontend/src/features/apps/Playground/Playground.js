import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Layout, Modal, Space, Switch, Tabs, Tour } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import useLocalStorageState from 'use-local-storage-state';
import { v4 as uuidv4 } from 'uuid';

import { useBeforeUnload } from '../../../app/useBeforeUnload';
import { usePrompt } from '../../../app/usePrompt';
import { Chat } from '../../../components/Chat';
import { ImageLibrary } from '../../../components/ImageLibrary';
import NavbarContext from '../../../context/NavbarContext';
import WorkspaceContext from '../../../context/WorkspaceContext';
import UserContext from '../../../context/UserContext';
import {
  createTrainingRowAsync,
  deleteTrainingRowAsync,
} from '../../training/trainingSlice';
import {
  getUploadsAsync,
} from '../../uploader/fileUploaderSlice';
import {
  getUsersAsync,
  selectUsers,
} from '../../users/usersSlice';

import {
  getAppAsync,
  selectApps,
} from '../appsSlice';

import { AppView } from './AppView';
import { ChatModal } from './ChatModal';
import { CopyParamsForm } from './CopyParamsForm';
import { CopyTable } from './CopyTable';
import { CreateContentModalForm } from './CreateContentModalForm';
import { ImageParamsForm } from './ImageParamsForm';
import { MySearchBox } from './MySearchBox';
import { PIIWarningModal } from './PIIWarningModal';
import { PlaygroundTour } from './PlaygroundTour';
import { VersionsModal } from './VersionsModal';
import {
  getPromptsAsync,
  getResponseAsync as getChatResponseAsync,
  selectLoading as selectChatLoading,
  selectMessages,
  setMessages,
} from './chatSlice';
import {
  createContentsAsync,
  deleteContentsAsync,
  getContentsAsync,
  getResponseAsync,
  selectContents,
  selectLoaded,
  selectLoading,
  selectPiiContent,
  selectUndoDisabled,
  selectRedoDisabled,
  setContents,
  setRating,
  undoAsync,
  redoAsync,
  updateContentsAsync,
} from './contentSlice';
import {
  createImagesAsync,
  deleteImagesAsync,
  findImageAsync,
  generateImageAsync,
  getContentImagesAsync,
  getImagesAsync,
  selectImages,
  selectLoading as selectImagesLoading,
} from './imagesSlice';

import 'instantsearch.css/themes/satellite.css';
import './Playground.css';

const { Content, Sider } = Layout;

const UNSAVED_CHANGES_MESSAGE = 'You have unsaved changes! Are you sure you want to leave?';

export function Playground() {

  const [activeTab, setActiveTab] = useLocalStorageState('activeTab', 1);
  const [currentStep, setCurrentStep] = useLocalStorageState('currentStep', 0);

  const [alertMessage, setAlertMessage] = useState(null);
  const [copyParams, setCopyParams] = useState({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editableRowKeys, setEditableRowKeys] = useState({});
  const [editableRowValues, setEditableRowValues] = useState({});
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState(null);
  const [service, setService] = useState('openai');
  const [tourOpen, setTourOpen] = useState(false);

  const apps = useSelector(selectApps);
  const chatLoading = useSelector(selectChatLoading);
  const contents = useSelector(selectContents);
  const images = useSelector(selectImages);
  const imagesLoading = useSelector(selectImagesLoading);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const messages = useSelector(selectMessages);
  const piiContent = useSelector(selectPiiContent);
  const users = useSelector(selectUsers);
  const undoDisabled = useSelector(selectUndoDisabled);
  const redoDisabled = useSelector(selectRedoDisabled);

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const {
    ref1,
    ref2,
    ref3,
    ref4,
    ref5,
    ref6,
    ref7,
    ref8,
    ref9,
    steps,
  } = PlaygroundTour();

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);
  const { currentUser } = useContext(UserContext);

  const [modal, contextHolder] = Modal.useModal();

  const id = location.pathname.match(/\/playground\/(.*)/)[1];

  if (!id) {
    navigate('/apps');
  }

  const app = apps[id];

  const copyData = useMemo(() => {
    const list = Object.values(contents).map((x) => {
      const item = {
        id: x.id,
        key: x.contentId,
        prompt: x.prompt,
        text: x.text,
        saveStatus: x.isNew || x.isChanged ? 'Unsaved' : 'Saved',
        approvalStatus: x.reviewers?.length ? 'In review' : x.status,
        image: x.image,
        likes: x.likes,
        model: x.model,
        rating: x.rating,
        usage: x.usage,
      };
      return item;
    });
    list.sort((a, b) => a.id < b.id ? 1 : -1);
    return list;
  }, [contents]);

  const imagesData = useMemo(() => {
    return Object.values(images).map((im) => ({
      key: im.imageId,
      imageUrl: im.imageUrl,
      status: im.isNew || im.isChanged ? 'Unsaved' : 'Saved',
      contentId: im.contentId,
    }));
  }, [images]);

  const userData = useMemo(() => {
    return Object.values(users).map((u) => ({
      key: u.username,
      label: u.email,
    }));
  }, [users]);

  const unsavedCopy = copyData.some((it) => it.saveStatus === 'Unsaved');
  const unsavedImages = imagesData.some((it) => it.status === 'Unsaved');
  const unsavedChanges = unsavedCopy || unsavedImages;

  const confirmation = (message) => {
    return new Promise((resolve) => {
      modal.confirm({
        title: 'Confirm',
        content: message,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  };

  const onCreate = () => {
    setCreateModalOpen(true);
  };

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: onCreate,
      title: 'Creative Workspace',
    }));
    dispatch(getAppAsync(id));
    dispatch(getContentsAsync({ appId: id }));
    dispatch(getImagesAsync({ appId: id }));
    dispatch(getUsersAsync());
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getUploadsAsync({ sourceId: selectedWorkspace.id }));
      setWorkspaceLoaded(true);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (app) {
      setNavbarState((state) => ({
        ...state,
        createLink: onCreate,
        title: app.name,
      }));
    }
  }, [app]);

  useEffect(() => {
    if (piiContent) {
      warnPII();
    }
  }, [piiContent]);

  useEffect(() => {
    if (service === 'gpt4all') {
      setAlertMessage('Using a self-hosted ChatGPT model avoids sharing sensitive information but is slower. The private service is currently running on dev-scale infrastructure. Responses usually take around 30 seconds.');
    }
  }, [service]);

  useBeforeUnload(unsavedChanges, UNSAVED_CHANGES_MESSAGE);

  usePrompt(unsavedChanges, UNSAVED_CHANGES_MESSAGE, confirmation);

  const editRow = (key) => {
    setEditableRowValues((current) => ({
      ...current,
      [key]: contents[key].text,
    }));
    setEditableRowKeys((current) => ({
      ...current,
      [key]: true,
    }));
  };

  const handleCreateCancel = () => {
    setCreateModalOpen(false);
  };

  const handleCreate = ({ content }) => {
    const username = currentUser.username;
    dispatch(setContents({
      contents: [
        {
          appId: id,
          contentId: uuidv4(),
          isNew: true,
          text: content,
          createdBy: username,
          modifiedBy: username,
          model: 'human',
        }
      ]
    }));
    setCreateModalOpen(false);
  };

  const handleTabChange = async (activeKey) => {
    let proceed;
    if (activeTab === '1' && unsavedCopy) {
      proceed = await confirmation('You have unsaved copy! Are you sure you want to proceed?');
    } else if (activeTab === '2' && unsavedImages) {
      proceed = await confirmation('You have unsaved images! Are you sure you want to proceed?');
    } else {
      proceed = true;
    }
    if (proceed) {
      dispatch(getImagesAsync({ appId: id }));
      setActiveTab(activeKey);
    }
  };

  const generateCopy = () => {
    const params = {
      ...app,
      ...copyParams,
      features: app.features,
    };
    dispatch(getResponseAsync({
      appId: app.id,
      app: params,
      userId: currentUser.username,
      service,
    }));
  };

  const generateCopyImage = (key) => {
    dispatch(findImageAsync(id, key, {
      content: contents[key].text,
      workspaceId: selectedWorkspace.id,
      start: imagesData.length,
    }));
  };

  const generateImage = ({ n, prompt }) => {
    dispatch(generateImageAsync(id, null, {
      prompt,
      n,
      sourceId: selectedWorkspace.id,
    }));
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleChatReset = () => {
    dispatch(setMessages({ messages: [] }));
  };

  const handleChatSubmit = (values) => {
    dispatch(getChatResponseAsync(values));
  };

  const handleCloseAlert = () => {
    setAlertMessage(null);
  };

  const handleRefineCancel = () => {
    dispatch(setMessages({ messages: [] }));
    setIsChatModalOpen(false);
  };

  const handleRefineSet = ({ key, content }) => {
    setEditableRowValues((current) => ({
      ...current,
      [key]: content,
    }));
    setEditableRowKeys((current) => ({
      ...current,
      [key]: true,
    }));

    // TODO - inefficient
    const row = copyData.find((r) => r.key === key);
    if (row?.saveStatus !== 'Unsaved') {
      row.saveStatus = 'Unsaved';
    }

    setIsChatModalOpen(false);
  };

  const handleUndo = () => {
    dispatch(undoAsync());
  };

  const handleRedo = () => {
    dispatch(redoAsync());
  };

  const handleVersionRollback = (selectedVersion) => {
    const key = selectedRow.contentId;
    const ver = selectedRow.versions.find((v) => v.hash === selectedVersion);

    setEditableRowValues((current) => ({
      ...current,
      [key]: ver.text,
    }));
    setEditableRowKeys((current) => ({
      ...current,
      [key]: true,
    }));

    // TODO - inefficient
    const row = copyData.find((r) => r.key === key);
    if (row?.saveStatus !== 'Unsaved') {
      row.saveStatus = 'Unsaved';
    }

    setIsModalOpen(false);
  };

  const increaseLength = (key) => {
    const content = contents[key];
    const { text } = content;
    const nWords = text.split(/\s/).length;
    const params = {
      ...app,
      prompt: content.text,
      maxTokens: Math.floor(nWords * 2),
    };
    dispatch(getResponseAsync({
      appId: app.id,
      contentId: key,
      app: params,
      userId: currentUser.username,
    }));
  };

  const reduceLength = (key) => {
    const content = contents[key];
    const { text } = content;
    const nWords = text.split(/\s/).length;
    const params = {
      ...app,
      prompt: content.text,
      maxTokens: Math.floor(nWords / 2),
    };
    dispatch(getResponseAsync({
      appId: app.id,
      contentId: key,
      app: params,
      userId: currentUser.username,
    }));
  };

  const like = (key) => {

    // TODO - inefficient
    const row = copyData.find((r) => r.key === key);

    if (row) {
      if (row.likes) {
        dispatch(deleteTrainingRowAsync({ contentId: key }));
      } else if (row.prompt) {
        dispatch(createTrainingRowAsync({
          contentId: key,
          workspaceId: selectedWorkspace.id,
          prompt: row.prompt,
          response: row.text,
        }));
      }
    }
  };

  const onChangeRowCopy = (key, value) => {

    // TODO - inefficient
    const row = copyData.find((r) => r.key === key);
    if (row?.saveStatus !== 'Unsaved') {
      row.saveStatus = 'Unsaved';
    }

    setEditableRowValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const onDelete = (keys) => {
    dispatch(deleteContentsAsync({ keys }));
  };

  const onDeleteImages = (keys) => {
    dispatch(deleteImagesAsync({ keys }));
  };

  const onExpand = (expanded, record) => {
    if (expanded) {
      dispatch(getContentImagesAsync({ contentId: record.key }));
    }
  };

  const onRatingChange = (key, rating = 0) => {

    // TODO - inefficient
    const row = copyData.find((r) => r.key === key);

    if (row) {
      if (row.saveStatus === 'Unsaved') {
        dispatch(setRating({ key, rating }));
      } else {
        const content = contents[key];
        const newContent = { ...content, rating };
        dispatch(updateContentsAsync({ values: [newContent], userId: currentUser.username }));
      }

      // add high rated content to the training data even if
      // the content isn't saved
      if (row.rating && row.rating > 3 && rating < 4) {
        dispatch(deleteTrainingRowAsync({ contentId: key }));
      }
      if (rating > 3 && (!row.rating || row.rating < 4) && row.prompt) {
        dispatch(createTrainingRowAsync({
          contentId: key,
          workspaceId: selectedWorkspace.id,
          prompt: row.prompt,
          response: row.text,
        }));
      }
    }
  };

  const onSave = (keys) => {
    const inserts = [], updates = [];
    for (const key of keys) {
      let item = contents[key];
      if (editableRowKeys[key]) {
        item = { ...item, text: editableRowValues[key] };
      }
      if (item.isNew) {
        inserts.push(item);
      } else {
        updates.push(item);
      }
    }
    dispatch(createContentsAsync({ values: inserts }));
    dispatch(updateContentsAsync({ values: updates, userId: currentUser.username }));
    setEditableRowKeys({});
    setEditableRowValues({});
  };

  const onSaveImages = (keys) => {
    const inserts = [];
    for (const key of keys) {
      const item = images[key];
      if (item.isNew) {
        inserts.push(item);
      }
    }
    dispatch(createImagesAsync({ values: inserts }));
  };

  const onTourClose = () => {
    if (currentStep === steps.length - 1) {
      setCurrentStep(0);
    }
    setTourOpen(false);
  };

  const refine = (key) => {
    setIsChatModalOpen(true);
    const content = contents[key];
    const messages = [
      // {
      //   key: uuidv4(),
      //   role: 'user',
      //   content: content.prompt,
      // },
      {
        key: content.contentId,
        role: 'assistant',
        content: content.text,
      }
    ];
    dispatch(setMessages({ messages }));
  };

  const showVersionsModal = (key) => {
    setSelectedRowKey(key);
    setIsModalOpen(true);
  };

  const submitForReview = (contentId, userId) => {
    const content = contents[contentId];
    const reviewers = content.reviewers || [];
    if (reviewers.indexOf(userId) === -1) {
      reviewers.push(userId);
      const newContent = { ...content, reviewers };
      dispatch(updateContentsAsync({ values: [newContent], userId: currentUser.username }));
    }
  };

  const suggestPrompts = ({ messages }) => {
    const params = {
      ...app,
      ...copyParams,
      features: app.features,
    };
    dispatch(getPromptsAsync({
      appId: app.id,
      app: params,
      messages,
    }));
  };

  const selectedRow = contents[selectedRowKey];

  const warnPII = () => (
    <PIIWarningModal piiContent={piiContent} />
  );

  return (
    <>
      {contextHolder}
      {alertMessage ?
        <Alert banner closable showIcon type="info"
          message={alertMessage}
          onClose={handleCloseAlert}
        />
        : null
      }
      <div id="playground" style={{ marginTop: 20 }}>
        <Layout>
          <Sider ref={ref1}
            style={{ marginRight: 20 }}
            width={250}
            theme="light"
          >
            <AppView app={app} />
          </Sider>
          <Content>
            <div style={{ float: 'right' }}>
              <Space size="large">
                <div>
                  <Space size="small">
                    <Switch
                      checked={service === 'gpt4all'}
                      disabled={true}
                      onChange={(checked) => setService(checked ? 'gpt4all' : 'openai')}
                    />
                    <label className="disabled">Private</label>
                  </Space>
                </div>
                <Button
                  onClick={() => setTourOpen(true)}
                  size="small"
                  style={{ fontSize: '0.85em' }}
                >
                  {currentStep > 0 ? 'Resume Tour' : 'Begin Tour'}
                </Button>
              </Space>
            </div>
            <div style={{ height: 40, marginBottom: 16 }}>
              {workspaceLoaded ?
                <MySearchBox
                  appId={id}
                  data={copyData}
                  workspaceId={selectedWorkspace.id}
                  tourRefs={{ search: ref2 }}
                />
                : null
              }
            </div>
            <div ref={ref3}></div>
            <Tabs activeKey={activeTab} onChange={handleTabChange} items={[
              {
                key: '1',
                label: 'Copy',
                children: (
                  <Layout>
                    <Content>
                      <CopyTable
                        data={copyData}
                        editRow={editRow}
                        editableRowValues={editableRowValues}
                        generateCopyImage={generateCopyImage}
                        imagesData={imagesData}
                        imagesLoading={imagesLoading}
                        increaseLength={increaseLength}
                        like={like}
                        loaded={loaded}
                        loading={loading}
                        name={app?.name}
                        onChangeRowCopy={onChangeRowCopy}
                        onDelete={onDelete}
                        onDeleteImages={onDeleteImages}
                        onExpand={onExpand}
                        onRatingChange={onRatingChange}
                        onSave={onSave}
                        onSaveImages={onSaveImages}
                        reduceLength={reduceLength}
                        refine={refine}
                        showVersionsModal={showVersionsModal}
                        submitForReview={submitForReview}
                        tourRefs={{
                          save: ref9,
                        }}
                        userData={userData}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        undoDisabled={undoDisabled}
                        redoDisabled={redoDisabled}
                      />
                      <p style={{ margin: '16px 0', maxWidth: 800 }}>
                        Click <strong>Autogen</strong> to automatically generate copy using a
                        combination of app features and generation parameters on the right.
                        Alternatively, use <strong>Instruct</strong> to start an interactive session with ChatGPT.
                      </p>
                      <div style={{ display: 'flex' }}>
                        <div style={{ paddingRight: 15 }}>
                          <Button ref={ref7} type="primary"
                            icon={<ThunderboltOutlined />}
                            onClick={generateCopy}
                          >
                            Autogen
                          </Button>
                          <div style={{ color: 'rgb(136, 136, 136)', fontSize: '0.85em', marginTop: 8 }}>
                            Est. cost: $0.0002
                          </div>
                        </div>
                        <div style={{ borderLeft: '3px solid #303030', flex: 1, paddingLeft: 15 }}>
                          <div style={{ fontWeight: 600, lineHeight: '32px' }}>Instruct</div>
                          <Chat
                            appId={id}
                            app={app}
                            disabled={isChatModalOpen}
                            enableActions={true}
                            loading={chatLoading}
                            messages={messages}
                            onReset={handleChatReset}
                            onSubmit={handleChatSubmit}
                            suggestPrompts={suggestPrompts}
                            tourRefs={{
                              prompt: ref8,
                            }}
                          />
                        </div>
                      </div>
                    </Content>
                    <Sider
                      style={{ backgroundColor: 'inherit', marginLeft: 20 }}
                      width={250}
                    >
                      <CopyParamsForm
                        // generate={generateCopy}
                        onChange={setCopyParams}
                        tourRefs={{
                          variations: ref4,
                          maxTokens: ref5,
                          tone: ref6,
                          generate: ref7,
                          prompt: ref8,
                        }}
                      />
                    </Sider>
                  </Layout>
                )
              },
              {
                key: '2',
                label: 'Images',
                children: (
                  <Layout>
                    <Content style={{ position: 'relative' }}>
                      <ImageLibrary
                        data={imagesData}
                        loading={imagesLoading}
                        onDelete={onDeleteImages}
                        onSave={onSaveImages}
                      />
                    </Content>
                    <Sider
                      style={{ backgroundColor: 'inherit', paddingLeft: 40, paddingRight: 40 }}
                      width={300}
                    >
                      <ImageParamsForm generate={generateImage} />
                    </Sider>
                  </Layout>
                )
              },
            ]} />
          </Content>
        </Layout>
      </div>
      <Tour
        current={currentStep}
        onChange={setCurrentStep}
        open={tourOpen}
        onClose={onTourClose}
        steps={steps}
      />
      <ChatModal
        appId={id}
        app={app}
        loading={chatLoading}
        open={isChatModalOpen}
        onOk={handleRefineSet}
        onCancel={handleRefineCancel}
      />
      <VersionsModal
        handleCancel={handleCancel}
        onVersionRollback={handleVersionRollback}
        isModalOpen={isModalOpen}
        selectedRow={selectedRow}
      />
      <CreateContentModalForm
        open={createModalOpen}
        onCancel={handleCreateCancel}
        onOk={handleCreate}
      />
    </>
  );
};
