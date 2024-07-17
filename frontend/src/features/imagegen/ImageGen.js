import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  ColorPicker,
  Form,
  Input,
  Layout,
  Modal,
  Select,
  Slider,
  Space,
  Switch,
  Table,
  Upload,
  message,
} from 'antd';
import {
  LinkOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import isEmpty from 'lodash.isempty';
import useLocalStorageState from 'use-local-storage-state';
import { v4 as uuidv4 } from 'uuid';
// import { Cropper } from 'react-advanced-cropper';

import { BoundingBoxModalInput } from '../../components/BoundingBoxModalInput';
import { ImageLibrary } from '../../components/ImageLibrary';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  selectFunctions,
} from '../functions/functionsSlice';
import {
  getPromptSetsAsync,
  selectLoading as selectPromptSetsLoading,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';
import {
  fileUploadAsync,
  selectUploading,
} from '../uploader/fileUploaderSlice';

import { ModelParamsForm, initialValues as initialModelParamsValue } from '../designer/ModelParamsForm';
import {
  createChatSessionAsync,
  deleteChatSessionsAsync,
  getChatSessionsAsync,
  selectChatSessions,
  selectLoaded,
  selectLoading,
  updateChatSessionAsync,
} from '../designer/chatSessionsSlice';
import { fontOptions, textPlacementOptions } from '../designer/options';
import {
  getFunctionResponseAsync,
  getResponseAsync as getChatResponseAsync,
  selectLoading as selectChatLoading,
  selectMessages,
  setMessages,
  selectTraceId,
  setTraceId,
} from '../designer/chatSlice';
import {
  annotateImageAsync,
  createMaskAsync,
  cropImageAsync,
  createImagesAsync,
  deleteImagesAsync,
  getImagesAsync,
  selectImages,
  selectLoading as selectImagesLoading,
} from './imagesSlice';

import 'react-advanced-cropper/dist/style.css';

const { Content, Sider } = Layout;
const { TextArea } = Input;

const uiSchema = {
  'ui:title': 'Additional expected inputs',
  'ui:submitButtonOptions': {
    'norender': true,
  },
};

const colorPresets = [
  {
    label: 'primary',
    colors: ['#009ba5', '#edf23b', '#93fede', '#00ffc8', '#001318', '#000', '#fff'],
  },
];

export function ImageGen() {

  const [createdUuid, setCreatedUuid] = useState(null);
  // const [coordinates, setCoordinates] = useState({});
  // const [cropOpen, setCropOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [modelParams, setModelParams] = useState({});
  const [argsFormData, setArgsFormData] = useState(null);
  const [sessionsCollapsed, setSessionsCollapsed] = useLocalStorageState('imagegen-sessions-collapsed', { defaultValue: true });
  const [promptsCollapsed, setPromptsCollapsed] = useLocalStorageState('imagegen-prompts-collapsed', { defaultValue: true });
  const [request, setRequest] = useState(null);

  const chatSessions = useSelector(selectChatSessions);
  const functions = useSelector(selectFunctions);
  const imagesLoading = useSelector(selectImagesLoading);
  const images = useSelector(selectImages);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const messages = useSelector(selectMessages);
  const promptSets = useSelector(selectPromptSets);
  const promptSetsLoading = useSelector(selectPromptSetsLoading);
  const traceId = useSelector(selectTraceId);
  const uploading = useSelector(selectUploading);
  const chatLoading = useSelector(selectChatLoading);

  // console.log('images:', images);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  let id;
  const match = location.pathname.match(/\/imagegen\/(.*)/);
  if (match) {
    id = +match[1];
  }

  const [promptForm] = Form.useForm();
  const promptSetValue = Form.useWatch('promptSet', promptForm);
  const coordinatesValue = Form.useWatch('coordinates', promptForm);
  const textOverlayValue = Form.useWatch('textOverlay', promptForm);

  const [contentVar, varsSchema] = useMemo(() => {
    if (promptSetValue) {
      const promptSet = promptSets[promptSetValue];
      if (promptSet && promptSet.arguments) {
        const schema = promptSet.arguments;
        if (schema.type === 'object') {
          const contentVar = getInputProp(schema.properties);
          const newSchema = excludeProps([contentVar], schema);
          return [contentVar, newSchema];
        }
      }
    }
    return [null, null];
  }, [promptSetValue]);

  const imagesData = useMemo(() => {
    return Object.values(images).map((im) => {
      const filename = im.imageUrl.split('/').pop().split('?')[0];
      return {
        id: im.id,
        key: im.imageId,
        imageUrl: im.imageUrl,
        status: im.isNew || im.isChanged ? 'Unsaved' : 'Saved',
        name: filename,
        lastUploaded: im.modified,
        metadata: {
          'Create Date': im.created,
        },
        originalPrompt: im.originalPrompt,
        revisedPrompt: im.revisedPrompt,
        modelParams: im.modelParams,
        params: im.params,
      };
    });
  }, [images]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      title: 'Image Generation',
    }));
    if (id) {
      setPromptsCollapsed(false);
    }
    return () => {
      onReset();
    };
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getImagesAsync({ workspaceId }));
      dispatch(getPromptSetsAsync({ workspaceId }));
      dispatch(getChatSessionsAsync({ workspaceId, type: 'imagegen' }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (createdUuid && chatSessions) {
      const session = Object.values(chatSessions).find(s => s.uuid === createdUuid);
      if (session) {
        setSelectedSession(session);
        setCreatedUuid(null);
      }
    }
  }, [chatSessions, createdUuid]);

  useEffect(() => {
    if (!id && loaded) {
      const sessions = Object.values(chatSessions);
      if (sessions.length) {
        const lastSession = sessions.find(s => s.name === 'last session');
        // console.log('lastSession:', lastSession);
        if (lastSession) {
          dispatch(setMessages({ messages: lastSession.messages.filter(m => m).map(formatMessage) }));
          setSelectedSession(lastSession);
          // setInitialModelParams({
          //   ...lastSession.modelParams,
          //   models: lastSession.modelParams?.models?.map(m => m.id),
          //   criticModels: lastSession.modelParams?.criticModels?.map(m => m.id),
          // });
          setModelParams(lastSession.modelParams);
          promptForm.setFieldsValue({
            promptSet: lastSession.promptSetId,
            systemPrompt: lastSession.systemPromptInput,
          });
          setArgsFormData(lastSession.argsFormData);
        }
      }
    }
  }, [loaded]);

  useEffect(() => {
    if (functions && request) {
      const func = functions[request.functionId];
      if (func) {
        request.functionName = func.name;
        dispatch(getFunctionResponseAsync(request));
      }
      setRequest(null);
    }
  }, [functions]);

  const promptSetOptions = useMemo(() => {
    if (promptSets) {
      const list = Object.values(promptSets).map((s) => ({
        key: s.id,
        label: s.name,
        value: s.id,
      }));
      list.sort((a, b) => a.label < b.label ? -1 : 1);
      return list;
    }
    return [];
  }, [promptSets]);

  const columns = [
    {
      title: 'Sessions',
      dataIndex: 'name',
      width: '100%',
      render: (_, { key, name }) => (
        <Link onClick={() => openSession(key)}
          style={{ color: selectedSession?.id === key ? '#177ddc' : 'inherit' }}
        >{name}</Link>
      )
    },
  ];

  const data = useMemo(() => {
    const list = Object.values(chatSessions).map((sess) => ({
      key: sess.id,
      name: sess.name || sess.id,
      modified: sess.modified,
    }));
    list.sort((a, b) => a.modified > b.modified ? -1 : 1);
    return list;
  }, [chatSessions]);

  const openSession = (id) => {
    const session = chatSessions[id];
    dispatch(setMessages({ messages: session.messages.map(formatMessage) }));
    setSelectedSession(session);
    // setInitialModelParams({
    //   ...session.modelParams,
    //   models: session.modelParams?.models?.map(m => m.id),
    //   criticModels: session.modelParams?.criticModels?.map(m => m.id),
    // });
    setModelParams(session.modelParams);
    promptForm.setFieldsValue({
      promptSet: session.promptSetId,
      systemPrompt: session.systemPromptInput,
      textOverlay: session.textOverlay,
      subText: session.subText,
      textColor: session.textColor,
      font: session.font,
      textPlacement: session.textPlacement,
      coordinates: session.coordinates,
      blurTextBackground: session.blurTextBackground,
      textBackgroundTransparency: session.textBackgroundTransparency,
    });
    setArgsFormData(session.argsFormData);
  };

  const getInputStr = (messages) => {
    const message = messages[messages.length - 1];
    if (Array.isArray(message.content)) {
      const textContent = message.content.findLast(c => c.type === 'text');
      if (textContent) {
        return textContent.text;
      }
    }
    return null;
  }

  const getColor = (color) => {
    if (!color) {
      return '#fff';
    }
    if (typeof color === 'string') {
      return color;
    }
    return '#' + color.toHex();
  };
  const annotateImage = async () => {
    if (selectedImage) {
      const {
        font,
        subText,
        textColor,
        textOverlay,
        textPlacement,
        coordinates,
        blurTextBackground,
        textBackgroundTransparency,
      } = await promptForm.validateFields();
      dispatch(annotateImageAsync(selectedWorkspace.id, {
        imageId: selectedImage.id,
        subText,
        textColor: getColor(textColor),
        textOverlay,
        font,
        textPlacement,
        coordinates,
        blurTextBackground,
        textBackgroundTransparency,
      }));
    }
  };

  const handleCreateMask = async () => {
    const { coordinates } = await promptForm.validateFields();
    if (coordinates.width) {
      dispatch(createMaskAsync({
        workspaceId: selectedWorkspace.id,
        imageId: selectedImage.id,
        coordinates,
      }));
    }
    // setCropOpen(false);
    // setCoordinates({});
  };

  const handleCropImage = async () => {
    const { coordinates } = await promptForm.validateFields();
    if (coordinates.width) {
      dispatch(cropImageAsync({
        workspaceId: selectedWorkspace.id,
        imageId: selectedImage.id,
        coordinates,
      }));
    }
    // setCropOpen(false);
    // setCoordinates({});
  };

  const generateImage = async () => {
    let args;
    let engine;
    let history = [];
    let messages = [];
    const originalMessages = messages;
    const index = messages.findLastIndex(m => m.role !== 'user') + 1;
    history = messages.slice(0, index);
    messages = messages.slice(index);
    let sp;
    const {
      promptSet,
      systemPrompt,
      textOverlay,
      subText,
      textColor,
      font,
      textPlacement,
    } = await promptForm.validateFields();
    if (promptSet) {
      const ps = promptSets[promptSet];
      if (ps && ps.prompts) {
        engine = ps.templateEngine || 'es6';
        sp = ps.prompts
          .filter(p => p.role === 'system')
          .map(p => p.prompt)
          .join('\n\n')
          ;
        if (contentVar || varsSchema) {
          const nonSystemMessages = ps.prompts
            .filter(p => p.role !== 'system')
            .map(p => ({ role: p.role, content: p.prompt }))
            ;
          if (contentVar) {
            args = { [contentVar]: systemPrompt };
            const idx = nonSystemMessages.findLastIndex(m => m.role !== 'user') + 1;
            if (nonSystemMessages.length > 1) {
              history = [
                ...nonSystemMessages.slice(0, idx),
                ...history,
              ];
            }
            messages = nonSystemMessages.slice(idx);
          } else {
            if (nonSystemMessages.length > 0) {
              history = [
                ...nonSystemMessages,
                ...history,
              ];
            }
          }
          if (varsSchema) {
            args = { ...args, ...argsFormData };
          }
        } else {
          history = [
            ...ps.prompts.filter(p => p.role !== 'system').map(p => ({ role: p.role, content: p.prompt })),
            ...history,
          ];
        }
      } else {
        console.error(`prompt set with id (${promptSet}) not found or has no prompts`);
      }
    } else if (systemPrompt) {
      sp = systemPrompt;
    }
    if (messages.length > 1) {
      let content = [];
      for (const m of messages) {
        if (typeof m.content === 'string') {
          content.push({
            type: 'text',
            text: m.content,
          });
        } else {
          content.push(...m.content);
        }
      }
      messages = [
        {
          role: 'user',
          content,
        }
      ];
    }
    const payload = {
      systemPrompt: sp,
      promptSetId: promptSet,
      systemPromptInput: systemPrompt,
      textOverlay,
      subText,
      textColor: getColor(textColor),
      font: font || 'Helvetica',
      textPlacement,
      history,
      messages,
      originalMessages: [...originalMessages.slice(0, index), ...messages],
      args,
      engine,
      modelParams,
      workspaceId: selectedWorkspace.id,
    };
    dispatch(getChatResponseAsync(payload, selectedWorkspace.id, true));
  };

  const onReset = () => {
    dispatch(setMessages({ messages: [] }));
    setSelectedSession(null);
    clearPromptFields();
    setModelParams({
      ...initialModelParamsValue,
      models: initialModelParamsValue.models?.map(id => ({ id })),
    });
    setArgsFormData(null);
  };

  const clearPromptFields = () => {
    promptForm.resetFields();
  };

  const onSave = async () => {
    const {
      promptSet,
      systemPrompt,
    } = await promptForm.validateFields();
    if (selectedSession && !(selectedSession.name === 'last session')) {
      dispatch(updateChatSessionAsync({
        id: selectedSession.id,
        values: {
          argsFormData,
          messages,
          modelParams,
          promptSetId: promptSet,
          systemPromptInput: systemPrompt,
          workspaceId: selectedWorkspace.id,
        },
      }));
    } else {
      const uuid = uuidv4();
      dispatch(createChatSessionAsync({
        uuid,
        values: {
          argsFormData,
          messages,
          modelParams,
          promptSetId: promptSet,
          systemPromptInput: systemPrompt,
          type: 'imagegen',
          workspaceId: selectedWorkspace.id,
        },
      }));
      setCreatedUuid(uuid);
    }
  };

  const onDelete = () => {
    dispatch(deleteChatSessionsAsync({ ids: selectedRowKeys }));
    if (selectedSession && selectedRowKeys.includes(selectedSession.id)) {
      onReset();
      setSelectedSession(null);
    }
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const handleChange = (info) => {
    if (info.file.status === 'uploading') {
      return;
    }
    if (info.file.status === 'done') {
      dispatch(fileUploadAsync(selectedWorkspace.id, info.file, true));
    }
  };

  // const handleCropCancel = () => {
  //   setCropOpen(false);
  // };

  const onChangeImage = (image) => {
    // console.log('selected image:', image);
    // promptForm.setFieldValue('systemPrompt', image.revisedPrompt);
  };

  // const onCropChange = (cropper) => {
  //   const coords = cropper.getCoordinates();
  //   console.log('crop coordinates:', coords);
  //   setCoordinates(coords);
  // };

  const onDeleteImages = (keys) => {
    dispatch(deleteImagesAsync({ keys }));
  };

  const onSaveImages = (keys) => {
    const inserts = [];
    // console.log('images:', images);
    // console.log('keys:', keys);
    for (const key of keys) {
      const item = images[key];
      if (item.isNew) {
        inserts.push(item);
      }
    }
    dispatch(createImagesAsync({ values: inserts }));
  };

  const onRemixImage = (image) => {
    console.log('selected image:', image);
    const params = image.params || {};
    const values = {
      systemPrompt: image.revisedPrompt,
      textOverlay: params.textOverlay,
      subText: params.subText,
      textColor: params.textColor,
      font: params.font,
      textPlacement: params.textPlacement,
    }
    promptForm.setFieldsValue(values);
    setModelParams(image.modelParams);
    // set original image
    const img = Object.values(images).find(im => im.id === params.imageId);
    setSelectedImage(img || image);
  };

  const uploadButton = (
    <div>
      {uploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>
        {uploading ? 'Uploading...' : 'Upload Image'}
      </div>
    </div>
  );

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [
      Table.SELECTION_ALL,
    ],
  };

  const hasSelected = selectedRowKeys.length > 0;
  const hasImage = messages
    .filter(m => m.role === 'user')
    .some(m => {
      if (Array.isArray(m.content)) {
        return m.content.some(c => c.type === 'image_url');
      }
      return false;
    });

  return (
    <>
      {contextHolder}
      {/* <Modal
        open={cropOpen}
        onCancel={handleCropCancel}
        footer={[
          <Button key="back" onClick={handleCropCancel}>
            Cancel
          </Button>,
          <Button type="primary" onClick={handleCropImage}>
            Crop
          </Button>,
          <Button type="primary" onClick={handleCreateMask}>
            Create Mask Image
          </Button>,
        ]}
      >
        <Cropper
          src={selectedImage?.imageUrl}
          onChange={onCropChange}
          className="cropper"
        />
      </Modal> */}
      <div style={{ height: '100%', marginTop: 20 }}>
        <Layout style={{ height: '100%' }}>
          <Sider
            collapsible
            collapsed={sessionsCollapsed}
            collapsedWidth={0}
            trigger={null}
            style={{
              borderRadius: 8,
              border: sessionsCollapsed ? '1px solid #f5f5f5' : '1px solid #f0f0f0',
              height: '100%',
              marginRight: 20,
            }}
            width={250}
            theme="light"
          >
            <div style={{ margin: '24px 8px 16px' }}>
              <Button danger type="primary" size="small" onClick={onDelete} disabled={!hasSelected}>
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
            />
          </Sider>
          <Sider
            collapsible
            collapsed={promptsCollapsed}
            collapsedWidth={0}
            trigger={null}
            style={{
              borderRadius: 8,
              border: promptsCollapsed ? '1px solid #f5f5f5' : '1px solid #f0f0f0',
              height: '100%',
              marginRight: 20,
            }}
            width={250}
            theme="light"
          >
            <Form
              autoComplete="off"
              form={promptForm}
              layout="vertical"
              name="prompts-form"
              initialValues={{ promptSet: id }}
              style={{ padding: '24px 8px' }}
            >
              <div style={{ display: 'flex' }}>
                <Form.Item
                  label="Prompt Template"
                  name="promptSet"
                  style={{ marginBottom: 16, width: promptSetValue ? 202 : 234 }}
                >
                  <Select allowClear
                    loading={promptSetsLoading}
                    options={promptSetOptions}
                    optionFilterProp="label"
                  />
                </Form.Item>
                {promptSetValue ?
                  <Button
                    type="link"
                    icon={<LinkOutlined />}
                    onClick={() => navigate(`/prompt-sets/${promptSetValue}`)}
                    style={{ marginTop: 32, width: 32 }}
                  />
                  : null
                }
              </div>
              <div style={{ color: '#1677ff', marginBottom: 24 }}>
                <Link to="/prompt-sets">Browse templates...</Link>
              </div>
              <Form.Item
                label="Prompt"
                name="systemPrompt"
              >
                <TextArea
                  autoSize={{ minRows: 4, maxRows: 14 }}
                  disabled={!!promptSetValue}
                />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={chatLoading}
                  onClick={generateImage}
                >
                  Generate
                </Button>
              </Form.Item>
              {selectedImage ?
                <>
                  {/* <Form.Item>
                    <Button
                      type="primary"
                      onClick={() => setCropOpen(true)}
                    >
                      Crop / Mask
                    </Button>
                  </Form.Item> */}
                  <Form.Item
                    label="Text Overlay"
                    name="textOverlay"
                  >
                    <TextArea
                      autoSize={{ minRows: 1, maxRows: 4 }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="Sub text"
                    name="subText"
                  >
                    <TextArea
                      autoSize={{ minRows: 1, maxRows: 4 }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="Text Color"
                    name="textColor"
                  >
                    <ColorPicker presets={colorPresets} defaultValue="#fff" />
                  </Form.Item>
                  <Form.Item
                    label="Font"
                    name="font"
                  >
                    <Select allowClear
                      options={fontOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item
                    label="Placement"
                    name="textPlacement"
                  >
                    <Select allowClear
                      options={textPlacementOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item
                    label="Bounding Box"
                    name="coordinates"
                  >
                    <BoundingBoxModalInput imageUrl={selectedImage?.imageUrl} />
                  </Form.Item>
                  {/* <Form.Item
                    label="Blur Text Background"
                    name="blurTextBackground"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item> */}
                  <Form.Item
                    label="Text Background Transparency"
                    name="textBackgroundTransparency"
                    initialValue={0.7}
                  >
                    <Slider min={0} max={1.0} step={0.05} />
                  </Form.Item>
                  <Form.Item>
                    <Space wrap>
                      <Button
                        disabled={!textOverlayValue}
                        type="primary"
                        onClick={annotateImage}
                      >
                        Annotate
                      </Button>
                      <Button
                        disabled={!coordinatesValue?.width}
                        type="primary"
                        onClick={handleCropImage}
                      >
                        Crop
                      </Button>
                      <Button
                        disabled={!coordinatesValue?.width}
                        type="primary"
                        onClick={handleCreateMask}
                      >
                        Create Mask
                      </Button>
                    </Space>
                  </Form.Item>
                </>
                : null
              }
            </Form>
          </Sider>
          <Content>
            <div style={{ marginLeft: -8 }}>
              <Button
                type="text"
                icon={sessionsCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setSessionsCollapsed(cur => !cur)}
                style={{
                  fontSize: '14px',
                  width: 32,
                  height: 32,
                }}
              />
              <span>Sessions</span>
            </div>
            <div style={{ marginBottom: 10, marginLeft: -8 }}>
              <Button
                type="text"
                icon={promptsCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setPromptsCollapsed(cur => !cur)}
                style={{
                  fontSize: '14px',
                  width: 32,
                  height: 32,
                }}
              />
              <span>Prompts</span>
            </div>
            <ImageLibrary
              data={imagesData}
              loading={imagesLoading}
              onChange={onChangeImage}
              onDelete={onDeleteImages}
              onRemix={onRemixImage}
              onSave={onSaveImages}
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
            {varsSchema ?
              <div style={{ marginTop: 24, width: 868 }}>
                <div style={{ float: 'right' }}>
                  <Button type="default" size="small"
                    disabled={isEmpty(argsFormData)}
                    onClick={() => { setArgsFormData(null); }}
                  >
                    Reset vars
                  </Button>
                </div>
                <div style={{ width: '50%' }}>
                  <SchemaForm
                    schema={varsSchema}
                    uiSchema={uiSchema}
                    validator={validator}
                    formData={argsFormData}
                    onChange={(e) => setArgsFormData(e.formData)}
                    submitter={false}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  The message will be assigned to the `{contentVar}` variable if using a Prompt Template.
                </div>
              </div>
              : null
            }
          </Content>
          <Sider
            style={{ backgroundColor: 'inherit', marginLeft: 20 }}
            width={250}
          >
            <ModelParamsForm
              createImage={true}
              includes={{
                models: true,
                imageQuality: true,
                imageResponseFormat: true,
                imageSize: true,
                imageStyle: true,
                imageAspectRatio: true,
                negativePrompt: true,
                seed: true,
                imageOutputFormat: true,
                disablePromptRewriting: true,
              }}
              onChange={setModelParams}
              value={modelParams}
            />
          </Sider>
        </Layout>
      </div>
    </>
  );
}

const formatMessage = (m) => {
  if (Array.isArray(m.content)) {
    if (m.role === 'assistant') {
      return {
        key: uuidv4(),
        role: m.role,
        content: m.content.map(msg => ({
          key: uuidv4(),
          content: msg.content,
          model: msg.model,
        })),
      };
    }
  }
  return {
    key: uuidv4(),
    role: m.role,
    content: m.content,
  };
};

const inputTerms = ['input', 'text', 'content', 'query', 'question'];

const getInputProp = (props) => {
  return inputTerms.find(t => t in props);
};

const completionTerms = ['completion', 'response', 'result', 'answer'];

const getCompletionProp = (props) => {
  return completionTerms.find(t => t in props);
};

const criterionTerms = ['criterion', 'criteria'];

const getCritterionProp = (props) => {
  return criterionTerms.find(t => t in props);
};

const excludeProps = (props, schema) => {
  const schemaProps = { ...schema.properties };
  let required;
  if (schema.required) {
    required = [...schema.required];
  }
  for (const prop of props) {
    if (prop) {
      delete schemaProps[prop];
      if (required) {
        const index = required.indexOf(prop);
        if (index > -1) {
          required.splice(index, 1);
        }
      }
    }
  }
  if (Object.keys(schemaProps).length) {
    return {
      ...schema,
      properties: schemaProps,
      required,
    };
  }
  return null;
};

const beforeUpload = (file) => {
  // console.log('file:', file);

  const isPng = file.type === 'image/png';

  const isJpg = file.type === 'image/jpeg';

  if (!(isPng || isJpg)) {
    message.error('You may only upload an image file.');
  }

  const isLt2M = file.size / 1024 / 1024 < 100;

  if (!isLt2M) {
    message.error('File must be smaller than 100Mb.');
  }

  return (isPng || isJpg) && isLt2M;
};

// https://stackoverflow.com/questions/51514757/action-function-is-required-with-antd-upload-control-but-i-dont-need-it
const dummyRequest = ({ file, onSuccess }) => {
  setTimeout(() => {
    onSuccess('ok');
  }, 20);
};
