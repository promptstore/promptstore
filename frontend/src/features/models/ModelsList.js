import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Radio,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  AppstoreOutlined,
  CheckOutlined,
  DownloadOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import debounce from 'lodash.debounce';
import useLocalStorageState from 'use-local-storage-state';
import isEmpty from 'lodash.isempty';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  AnthropicLogo,
  BedrockLogo,
  EuropaLabsLogo,
  GeminiLogo,
  HuggingFaceLogo,
  Llama2Logo,
  LlamaApiLogo,
  MistralAILogo,
  OpenAILogo,
  VertexAILogo,
} from '../../logos';
import {
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

const { Search } = Input;

export function ModelsList() {

  const [filterPublic, setFilterPublic] = useLocalStorageState('models-filter-system', { defaultValue: false });
  const [layout, setLayout] = useLocalStorageState('models-layout', { defaultValue: 'grid' });
  const [page, setPage] = useLocalStorageState('models-list-page', { defaultValue: 1 });
  const [searchValue, setSearchValue] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [numItems, setNumItems] = useLocalStorageState('models-num-items', { defaultValue: 12 });

  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const models = useSelector(selectModels);
  const uploading = useSelector(selectUploading);

  const data = useMemo(() => {
    if (layout === 'grid' && isEmpty(models)) {
      // show loading cards
      return [...Array(numItems).keys()].map(key => ({ key }));
    } else {
      const list = Object.values(models)
        .filter((model) => model.name.toLowerCase().indexOf(searchValue.toLowerCase()) !== -1)
        .filter((model) => filterPublic ? model.isPublic : true)
        .map((model) => ({
          key: model.id,
          modelKey: model.key,
          name: model.name,
          provider: model.provider || model.type,
          type: model.type,
          isPublic: model.isPublic,
          description: model.description,
          contextWindow: model.contextWindow,
        }));
      list.sort((a, b) => a.name > b.name ? 1 : -1);
      return list;
    }
  }, [models, filterPublic, searchValue]);

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
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getModelsAsync({
        workspaceId: selectedWorkspace.id,
        minDelay: layout === 'grid' ? 2000 : 0,
      }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 3,
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

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const formatNumber = (num) => {
    if (num) {
      num = +num;
      if (!isNaN(num)) {
        return num.toLocaleString('en-US');
      }
    }
    return null;
  }

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

  const ProviderLogo = ({ provider }) => {
    switch (provider) {
      case 'api':
        return (
          <EuropaLabsLogo />
        );

      case 'bedrock':
        return (
          <BedrockLogo />
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

      case 'vertexai':
        return (
          <VertexAILogo />
        );

      default:
        return null;
    }
  };

  const ProviderLabel = ({ provider }) => {
    switch (provider) {
      case 'api':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} />
            <div>Europa Labs</div>
          </Space>
        );

      case 'bedrock':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} />
            <div>Bedrock</div>
          </Space>
        );

      case 'gemini':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} />
            <div>Gemini</div>
          </Space>
        );

      case 'huggingface':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} />
            <div>Hugging Face</div>
          </Space>
        );

      case 'llama2':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} />
            <div>Llama 2</div>
          </Space>
        );

      case 'llamaapi':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} />
            <div>Llama API</div>
          </Space>
        );

      case 'mistral':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} />
            <div>Mistral</div>
          </Space>
        );

      case 'openai':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} />
            <div>OpenAI</div>
          </Space>
        );

      case 'vertexai':
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ProviderLogo provider={provider} />
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
    // {
    //   title: 'Type',
    //   dataIndex: 'type',
    //   render: (_, { type }) => (
    //     <div style={{ whiteSpace: 'nowrap' }}>{type}</div>
    //   )
    // },
    {
      title: 'Public',
      dataIndex: 'isPublic',
      render: (_, { isPublic }) => (
        <div style={{ fontSize: '1.5em', textAlign: 'center' }}>
          <span>{isPublic ? <CheckOutlined /> : null}</span>
        </div>
      )
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      render: (_, { provider }) => (
        <ProviderLabel provider={provider} />
      )
    },
    {
      title: 'Context Window',
      dataIndex: 'contextWindow',
      render: (_, { contextWindow }) => (
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          {formatNumber(contextWindow)}
        </div>
      )
    },
    {
      width: '100%',
    },
    {
      title: 'Action',
      key: 'action',
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

  function CardTitle({ provider, title }) {
    return (
      <Space>
        <ProviderLogo provider={provider} />
        <div>{title}</div>
      </Space>
    );
  }

  return (
    <>
      {contextHolder}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
            Delete
          </Button>
          {hasSelected ?
            <>
              <div style={{ marginLeft: 8 }}>
                Selected {selectedRowKeys.length} items
              </div>
              <Download filename={'models.json'} payload={selectedModels}>
                <Button type="text" icon={<DownloadOutlined />} />
              </Download>
            </>
            : null
          }
          <Search allowClear
            placeholder="find entries"
            onSearch={onSearch}
            style={{ marginLeft: 16, width: 220 }}
          />
          <Switch
            checked={filterPublic}
            onChange={setFilterPublic}
            style={{ marginLeft: 8 }}
          />
          <div style={{ marginLeft: 8 }}>Public</div>
          <div style={{ marginLeft: 16 }}>
            <Upload
              name="upload"
              showUploadList={false}
              customRequest={dummyRequest}
              beforeUpload={beforeUpload}
              onChange={onUpload}
            >
              <Button type="text" loading={uploading} icon={<UploadOutlined />} />
            </Upload>
          </div>
          <div style={{ flex: 1 }}></div>
          <Radio.Group
            buttonStyle="solid"
            onChange={(ev) => setLayout(ev.target.value)}
            optionType="button"
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
            value={layout}
          />
        </div>
        {layout === 'grid' ?
          <Space wrap size="large">
            {data.map(m =>
              <Card key={m.key}
                title={<CardTitle provider={m.provider} title={m.name} />}
                style={{ width: 350, height: 230 }}
                loading={loading}
              >
                <div style={{ display: 'flex', flexDirection: 'column', height: 126 }}>
                  <div>
                    <Space>
                      <Tag color={getColor(m.type)}>{m.type}</Tag>
                      <div>{m.modelKey}</div>
                    </Space>
                  </div>
                  <div style={{ height: 30, marginTop: 8 }}>
                    <Typography.Paragraph ellipsis>
                      {m.description}
                    </Typography.Paragraph>
                  </div>
                  <div style={{ marginTop: 5 }}>
                    <Typography.Text>
                      {m.contextWindow ?
                        <span><span className="inline-label">context window:</span> {formatNumber(m.contextWindow)}</span>
                        :
                        <span>&nbsp;</span>
                      }
                    </Typography.Text>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'row-reverse', marginTop: 'auto', gap: 16, alignItems: 'center' }}>
                    <Link to={`/models/${m.key}/edit`}>Edit</Link>
                    <Link to={`/models/${m.key}`}>View</Link>
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
          />
        }
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
