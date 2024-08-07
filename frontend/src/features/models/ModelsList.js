import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Segmented,
  Space,
  Switch,
  Table,
  Tag,
  Tree,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  AppstoreOutlined,
  CameraOutlined,
  CheckOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import * as dayjs from 'dayjs';
import debounce from 'lodash.debounce';
import useLocalStorageState from 'use-local-storage-state';
import isEmpty from 'lodash.isempty';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  AI21LabsLogo,
  AnthropicLogo,
  BedrockLogo,
  CohereLogo,
  EuropaLabsLogo,
  GeminiLogo,
  HuggingFaceLogo,
  Llama2Logo,
  LlamaApiLogo,
  MistralAILogo,
  OpenAILogo,
  StabilityAILogo,
  VertexAILogo,
} from '../../logos';
import { formatNumber } from '../../utils';

import {
  duplicateObjectAsync,
  objectUploadAsync,
  selectUploading,
} from '../uploader/fileUploaderSlice';

import {
  deleteModelsAsync,
  getModelsAsync,
  selectLoaded,
  selectLoading,
  selectModels,
} from './modelsSlice';
import {
  getAllProvidersAsync,
  getCustomModelProvidersAsync,
  selectProviders,
} from './modelProvidersSlice';

const { Search } = Input;

export function ModelsList() {

  const [filterImage, setFilterImage] = useLocalStorageState('models-filter-image', { defaultValue: false });
  const [filterMultimodal, setFilterMultimodal] = useLocalStorageState('models-filter-multimodal', { defaultValue: false });
  const [filterPublic, setFilterPublic] = useLocalStorageState('models-filter-system', { defaultValue: false });
  const [filterSystem, setFilterSystem] = useLocalStorageState('inherited-models', { defaultValue: false });
  const [layout, setLayout] = useLocalStorageState('models-layout', { defaultValue: 'grid' });
  const [page, setPage] = useLocalStorageState('models-list-page', { defaultValue: 1 });
  const [searchValue, setSearchValue] = useState('');
  const [selectedProviders, setSelectedProviders] = useLocalStorageState('selected-model-providers', { defaultValue: [] });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [numItems, setNumItems] = useLocalStorageState('models-num-items', { defaultValue: 12 });

  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const models = useSelector(selectModels);
  const providers = useSelector(selectProviders);
  const uploading = useSelector(selectUploading);

  const data = useMemo(() => {
    if (layout === 'grid' && isEmpty(models)) {
      // show loading cards
      return [...Array(numItems).keys()].map(key => ({ key }));
    } else {
      const list = Object.values(models)
        .filter((model) => model.name.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1)
        .filter((model) => filterMultimodal ? model.multimodal : true)
        .filter((model) => filterImage ? model.type === 'imagegen' : true)
        .filter((model) => filterPublic ? true : !model.isPublic)
        .filter((model) => filterSystem ? true : !model.isSystem)
        .filter((model) => selectedProviders.length === 0 || selectedProviders.includes(model.provider || model.type))
        .map((model) => ({
          key: model.id,
          modelKey: model.key,
          name: model.name,
          provider: model.provider || model.type,
          type: model.type,
          isPublic: model.isPublic,
          isSystem: model.isSystem,
          description: model.description,
          contextWindow: model.contextWindow,
          maxOutputTokens: model.maxOutputTokens,
          multimodal: model.multimodal,
          creditsPerCall: model.creditsPerCall,
          trainingDate: model.trainingDate,
        }));
      list.sort((a, b) => a.name > b.name ? 1 : -1);
      return list;
    }
  }, [models, filterImage, filterMultimodal, filterPublic, filterSystem, searchValue, selectedProviders]);

  const providerOptions = useMemo(() => {
    const list = [
      {
        label: 'Custom',
        value: 'api',
      },
    ];
    if (providers.all) {
      list.push(...providers.all.map(p => ({
        label: p.name,
        value: p.key,
      })));
    }
    if (providers.custom) {
      list.push(...providers.custom.map(p => ({
        label: p.name,
        value: p.key,
      })));
    }
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [providers]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/models/new/edit',
      title: 'Models',
    }));
    dispatch(getAllProvidersAsync());
    dispatch(getCustomModelProvidersAsync());
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getModelsAsync({
        workspaceId: selectedWorkspace.id,
        minDelay: layout === 'grid' ? 1000 : 0,
      }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 5,
      });
    }
  }, [location]);

  useEffect(() => {
    if (loaded) {
      setNumItems(Object.keys(models).length);
    }
  }, [loaded, models]);

  const onDelete = () => {
    dispatch(deleteModelsAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSearch = debounce((q) => {
    setSearchValue(q);
  }, 1000);

  const handleDuplicate = (key) => {
    const model = models[key];
    dispatch(duplicateObjectAsync({
      obj: model,
      type: 'model',
      workspaceId: selectedWorkspace.id,
    }));
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const getColor = (type) => {
    if (type === 'gpt') {
      return '#108ee9';
    }
    if (type === 'api') {
      return '#87d068';
    }
    if (type === 'completion') {
      return '#2db7f5';
    }
    if (type === 'embedding') {
      return '#a219ff';
    }
    return null;
  }

  const ProviderLogo = ({ provider, modelKey }) => {
    switch (provider) {
      case 'anthropic':
        return (
          <AnthropicLogo />
        );

      case 'api':
        return (
          <EuropaLabsLogo />
        );

      case 'bedrock':
        if (modelKey.startsWith('anthropic')) {
          return (
            <AnthropicLogo />
          );
        }
        if (modelKey.startsWith('ai21')) {
          return (
            <AI21LabsLogo />
          );
        }
        if (modelKey.startsWith('stability')) {
          return (
            <StabilityAILogo />
          );
        }
        return (
          <BedrockLogo />
        );

      case 'cohere':
        return (
          <CohereLogo />
        );

      case 'gemini':
        return (
          <GeminiLogo />
        );

      case 'huggingface':
        return (
          <HuggingFaceLogo />
        );

      case 'llama2':
        return (
          <Llama2Logo />
        );

      case 'llamaapi':
        return (
          <LlamaApiLogo />
        );

      case 'mistral':
        return (
          <MistralAILogo />
        );

      case 'openai':
        return (
          <OpenAILogo />
        );

      case 'stabilityai':
        return (
          <StabilityAILogo />
        );

      case 'vertexai':
        return (
          <VertexAILogo />
        );

      default:
        return null;
    }
  };

  const ProviderLabel = ({ provider, modelKey }) => {
    switch (provider) {
      case 'anthropic':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Anthropic</div>
          </Space>
        );

      case 'api':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Europa Labs</div>
          </Space>
        );

      case 'bedrock':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Bedrock</div>
          </Space>
        );

      case 'cohere':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Cohere</div>
          </Space>
        );

      case 'gemini':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Gemini</div>
          </Space>
        );

      case 'huggingface':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Hugging Face</div>
          </Space>
        );

      case 'llama2':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Llama 2</div>
          </Space>
        );

      case 'llamaapi':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Llama API</div>
          </Space>
        );

      case 'mistral':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Mistral</div>
          </Space>
        );

      case 'openai':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>OpenAI</div>
          </Space>
        );

      case 'stabilityai':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Stability AI</div>
          </Space>
        );

      case 'vertexai':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} modelKey={modelKey} />
            <div>Vertex AI</div>
          </Space>
        );

      default:
        return (
          <div style={{ whiteSpace: 'nowrap' }}>{provider}</div>
        );
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250, whiteSpace: 'nowrap' }}>
          <Link to={`/models/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Key',
      dataIndex: 'modelKey',
      render: (_, { modelKey }) => (
        <div style={{ whiteSpace: 'nowrap' }}>{modelKey}</div>
      )
    },
    {
      title: 'Public',
      dataIndex: 'isPublic',
      align: 'center',
      render: (_, { isPublic }) => (
        <div style={{ fontSize: '1.5em' }}>
          <span>{isPublic ? <CheckOutlined /> : null}</span>
        </div>
      )
    },
    {
      title: 'Multimodal',
      dataIndex: 'multimodal',
      align: 'center',
      render: (_, { multimodal }) => (
        <div style={{ fontSize: '1.5em' }}>
          <span>{multimodal ? <CheckOutlined /> : null}</span>
        </div>
      )
    },
    {
      title: 'Type',
      dataIndex: 'type',
      render: (_, { type }) => (
        <div style={{ whiteSpace: 'nowrap' }}>{type}</div>
      )
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      render: (_, { modelKey, provider }) => (
        <ProviderLabel provider={provider} modelKey={modelKey} />
      )
    },
    {
      title: 'Context Window',
      dataIndex: 'contextWindow',
      align: 'right',
      render: (_, { contextWindow }) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {contextWindow ? formatNumber(contextWindow) : <span>&ndash;</span>}
        </div>
      )
    },
    {
      title: 'Avg. Credits',
      dataIndex: 'creditsPerCall',
      align: 'right',
      render: (_, { creditsPerCall }) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {creditsPerCall ? formatNumber(creditsPerCall) : '0'}
        </div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 225,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/models/${record.key}`)}
          >
            View
          </Button>
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/models/${record.key}/edit`)}
          >
            Edit
          </Button>
          <Button type="link"
            onClick={() => handleDuplicate(record.key)}
            style={{ paddingLeft: 0 }}
          >
            Duplicate
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

  const selectedModels = selectedRowKeys.map(id => models[id]);

  const onUpload = (info) => {
    if (info.file.status === 'uploading') {
      return;
    }
    if (info.file.status === 'done') {
      dispatch(objectUploadAsync({
        file: info.file,
        type: 'model',
        workspaceId: selectedWorkspace.id,
      }));
    }
  };

  const treeData = [
    {
      title: 'All',
      key: 'all',
      children: providerOptions.map(p => ({
        title: <Typography.Text ellipsis>{p.label}</Typography.Text>,
        key: p.value,
      })),
    }
  ];

  const selectProvider = (selectedKeys) => {
    if (selectedKeys[0] === 'all') {
      setSelectedProviders([]);
    } else {
      setSelectedProviders(selectedKeys);
    }
  };

  function CardTitle({ modelKey, provider, title }) {
    return (
      <Space>
        <ProviderLogo provider={provider} modelKey={modelKey} />
        <div>{title}</div>
      </Space>
    );
  }

  return (
    <>
      {contextHolder}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
              Delete
            </Button>
            {hasSelected ?
              <>
                <span>
                  Selected {selectedRowKeys.length} items
                </span>
                <Download filename={'models.json'} payload={selectedModels}>
                  <Button type="text" icon={<DownloadOutlined />}>
                    Export
                  </Button>
                </Download>
              </>
              : null
            }
          </div>
          <Search allowClear
            placeholder="search filter"
            onSearch={onSearch}
            style={{ width: 220 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={filterPublic}
              onChange={setFilterPublic}
            />
            <div>Public</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={filterSystem}
              onChange={setFilterSystem}
            />
            <div>System</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={filterMultimodal}
              onChange={setFilterMultimodal}
            />
            <div>Multimodal</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={filterImage}
              onChange={setFilterImage}
            />
            <div>Image</div>
          </div>
          <Upload
            name="upload"
            showUploadList={false}
            customRequest={dummyRequest}
            beforeUpload={beforeUpload}
            onChange={onUpload}
          >
            <Button type="text" loading={uploading} icon={<UploadOutlined />}>
              Import
            </Button>
          </Upload>
          <div style={{ flex: 1 }}></div>
          <Segmented
            onChange={setLayout}
            value={layout}
            style={{ background: 'rgba(0, 0, 0, 0.25)' }}
            options={[
              {
                label: <UnorderedListOutlined />,
                value: 'list'
              },
              {
                label: <AppstoreOutlined />,
                value: 'grid'
              },
            ]}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'start', gap: 16, width: '100%' }}>
          <div className="folders">
            <div className="heading-wrapper">
              <div className="heading">
                Providers
              </div>
            </div>
            <Tree
              defaultExpandAll
              treeData={treeData}
              onSelect={selectProvider}
              defaultSelectedKeys={selectedProviders}
            />
          </div>
          {layout === 'grid' ?
            <Space wrap size="large">
              {data.map(m =>
                <Card key={m.key} className="model-card"
                  title={<CardTitle provider={m.provider} modelKey={m.modelKey} title={m.name} />}
                  style={{ width: 350, height: 255 }}
                  loading={loading}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: 151 }}>
                    {m.description ?
                      <Typography.Text ellipsis>{m.description}</Typography.Text>
                      :
                      <Typography.Text>&nbsp;</Typography.Text>
                    }
                    <Space>
                      <Tag color={getColor(m.type)}>{m.type}</Tag>
                      <div>{m.modelKey}</div>
                    </Space>
                    <div>
                      {m.contextWindow ?
                        <Typography.Text style={{ display: 'inline-block', width: '50%' }}>
                          <div>
                            <span className="inline-label">context</span> {formatNumber(m.contextWindow)}
                          </div>
                        </Typography.Text>
                        : null
                      }
                      {m.creditsPerCall ?
                        <Typography.Text style={{ display: 'inline-block' }}>
                          <div>
                            <span className="inline-label">credits</span> ~{formatNumber(m.creditsPerCall)}
                          </div>
                        </Typography.Text>
                        :
                        <Typography.Text style={{ display: 'inline-block' }}>
                          <div>
                            <span className="inline-label">credits</span> 0
                          </div>
                        </Typography.Text>
                      }
                    </div>
                    <div>
                      {m.maxOutputTokens ?
                        <Typography.Text style={{ display: 'inline-block', width: '50%' }}>
                          <span><span className="inline-label">max out</span> {formatNumber(m.maxOutputTokens)}</span>
                        </Typography.Text>
                        : null
                      }
                      {m.trainingDate ?
                        <Typography.Text style={{ display: 'inline-block', width: '50%' }}>
                          <span><span className="inline-label">trained</span> {dayjs(m.trainingDate).format('MMM, YYYY')}</span>
                        </Typography.Text>
                        : null
                      }
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'row-reverse', marginTop: 'auto', gap: 16, alignItems: 'center' }}>
                      <Link to={`/models/${m.key}/edit`}>Edit</Link>
                      <Link to={`/models/${m.key}`}>View</Link>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 10, alignItems: 'center' }}>
                        {m.type === 'imagegen' ?
                          <ThunderboltOutlined />
                          :
                          <>
                            {m.multimodal ?
                              <>
                                <VideoCameraOutlined />
                                <CameraOutlined />
                              </>
                              : null
                            }
                            <div style={{ cursor: 'default', fontFamily: 'Times New Roman', fontWeight: 600 }}>T</div>
                          </>
                        }
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </Space>
            :
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={data}
              loading={loading}
              pagination={{
                current: page,
                onChange: (page, pageSize) => setPage(page),
              }}
              rowClassName="model-list-row"
              style={{ maxWidth: '100%' }}
            />
          }
        </div>
      </div>
    </>
  );
};

const beforeUpload = (file) => {
  // console.log('file:', file);

  const isJSON = file.type === 'application/json';

  if (!isJSON) {
    message.error('You may only upload a JSON file.');
  }

  const isLt2M = file.size / 1024 / 1024 < 100;

  if (!isLt2M) {
    message.error('File must be smaller than 100MB.');
  }

  return isJSON && isLt2M;
};

// https://stackoverflow.com/questions/51514757/action-function-is-required-with-antd-upload-control-but-i-dont-need-it
const dummyRequest = ({ file, onSuccess }) => {
  setTimeout(() => {
    onSuccess('ok');
  }, 20);
};
