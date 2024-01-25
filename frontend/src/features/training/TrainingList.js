import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Form,
  Input,
  Rate,
  Segmented,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { CSVLink } from 'react-csv';
import Highlighter from 'react-highlight-words';
import * as dayjs from 'dayjs';
import useLocalStorageState from 'use-local-storage-state';

import { JsonView } from '../../components/JsonView';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { decodeEntities } from '../../utils';
import {
  deleteTrainingDataAsync,
  getTrainingDataAsync,
  selectLoading,
  selectTrainingData,
  updateTrainingRowAsync,
} from './trainingSlice';

import './TrainingList.css';

const TextArea = Input.TextArea;

const criteriaValues = {
  conciseness: 'concise',
  relevance: 'relevant',
  correctness: 'correct',
  harmfulness: 'harmful',
  maliciousness: 'malicious',
  helpfulness: 'helpful',
  controversiality: 'controversial',
  mysogyny: 'misogynistic',
  criminality: 'criminal',
  insensitivity: 'insensitive',
};

const criteriaOptions = [
  {
    label: 'Concise',
    value: 'concise',
  },
  {
    label: 'Relevant',
    value: 'relevant',
  },
  {
    label: 'Correct',
    value: 'correct',
  },
  {
    label: 'Harmful',
    value: 'harmful',
  },
  {
    label: 'Malicious',
    value: 'malicious',
  },
  {
    label: 'Helpful',
    value: 'helpful',
  },
  {
    label: 'Controversial',
    value: 'controversial',
  },
  {
    label: 'Misogynistic',
    value: 'misogynistic',
  },
  {
    label: 'Criminal',
    value: 'criminal',
  },
  {
    label: 'Insensitive',
    value: 'insensitive',
  },
];

const EditableContext = React.createContext(null);

const EditableRow = ({ index, ...props }) => {

  const [form] = Form.useForm();

  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  );
};

const EditableCell = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {

  const form = useContext(EditableContext);

  const save = async () => {
    try {
      const values = await form.validateFields();
      handleSave({
        ...record,
        ...values,
      });
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  return (
    <td {...restProps}>
      <Form.Item>
        <Space direction="vertical">

        </Space>
      </Form.Item>
    </td>
  )
};

function EvalForm({ initialValues, onSave }) {

  const [form] = Form.useForm();

  const handleSave = (values) => {
    // console.log('values:', values);
    onSave(values);
  };

  const onCancel = () => {
    form.resetFields();
  }

  return (
    <div style={{ marginTop: 10 }}>
      <Form
        className="eval-form"
        initialValues={initialValues}
        form={form}
        onFinish={handleSave}
      >
        <Form.Item
          name="evals"
        >
          <Checkbox.Group
            className="eval-options"
            options={criteriaOptions}
          />
        </Form.Item>
        <Form.Item
          name="feedback"
          extra="Feedback"
        >
          <TextArea autoSize={{ minRows: 1, maxRows: 5 }} />
        </Form.Item>
        <Form.Item
          name="rating"
          extra="Overall Rating"
        >
          <Rate />
        </Form.Item>
        <Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'end' }}>
            <Button type="text" size="small" onClick={onCancel}>Cancel</Button>
            <Button type="primary" size="small" htmlType="submit">Save</Button>
          </div>
        </Form.Item>
      </Form>
    </div>
  );
}

function MachineEval({ evaluations }) {
  if (!evaluations) {
    return <div></div>;
  }
  const criteria = evaluations.map(e => e.criteria);
  const options = criteriaOptions.filter(o => criteria.includes(o.value));
  const value = evaluations.filter(e => e.result === 'Y').map(e => e.criteria);
  return (
    <div style={{ marginTop: 10 }}>
      <Checkbox.Group
        className="eval-options"
        options={options}
        value={value}
      />
    </div>
  );
}

export function TrainingList() {

  const [evalType, setEvalType] = useState({});
  const [page, setPage] = useLocalStorageState('training-list-page', { defdaultValue: 1 });
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const trainingData = useSelector(selectTrainingData);

  const data = useMemo(() => {
    const list = Object.values(trainingData).map((row) => {
      let outputType = row.outputType;
      let response;
      if (outputType === 'function_call') {
        response = row.modelOutput.function_call;
      } else {
        response = row.modelOutputText;
      }
      if (!response) {
        outputType = 'function_call';
        response = row.systemOutputText || row.systemOutput?.function_call;
      }
      const emap = {};
      if (row.evaluations) {
        for (const e of row.evaluations) {
          const criteria = criteriaValues[e.criteria];
          if (!emap[criteria]) {
            emap[criteria] = { ...e, criteria };
            continue;
          }
          if (emap[criteria].modified < e.modified) {
            emap[criteria] = { ...e, criteria };
          }
        }
      }
      let evaluations;
      if (Object.keys(emap).length) {
        evaluations = Object.values(emap);
        evaluations.sort((a, b) => {
          const i = criteriaOptions.findIndex(o => o.value === a.criteria);
          const j = criteriaOptions.findIndex(o => o.value === b.criteria);
          return i - j;
        });
      }
      return {
        key: row.id,
        prompt: row.modelInput || row.systemInput,
        outputType,
        response,
        model: row.model,
        functionName: row.functionName,
        humanEvaluation: row.humanEvaluation,
        evaluations,
      };
    });
    list.sort((a, b) => a.key > b.key ? 1 : -1);
    return list;
  }, [trainingData]);

  // console.log('data:', data);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const searchInput = useRef(null);

  const dispatch = useDispatch();

  const location = useLocation();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Call Logs',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getTrainingDataAsync({ workspaceId: selectedWorkspace.id }));
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

  const handleSave = (id, humanEvaluation) => {
    const values = { humanEvaluation };
    dispatch(updateTrainingRowAsync({ id, values }));
  };

  const onDelete = () => {
    dispatch(deleteTrainingDataAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    // console.log('handleSearch - selectedKeys:', selectedKeys);
    // console.log('handleSearch - dataIndex:', dataIndex);
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters) => {
    clearFilters();
    setSearchText('');
  };

  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div style={{ padding: 8 }} onKeyDown={ev => ev.stopPropagation()}>
        <Input
          allowClear
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={ev => {
            if (ev.target.value) {
              setSelectedKeys([ev.target.value]);
            } else {
              clearFilters && handleReset(clearFilters);
              handleSearch(selectedKeys, confirm, dataIndex);
              setSelectedKeys([]);
            }
          }}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: 'flex' }}>
          <Button type="primary"
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            size="small"
          >
            Search
          </Button>
          <div style={{ flex: 1 }} />
          <Button type="link"
            size="small"
            onClick={() => close()}
          >
            close
          </Button>
        </div>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined style={{ color: filtered ? '1677ff' : undefined }} />
    ),
    onFilter: (value, record) => {
      // console.log('onFilter -', dataIndex, ':', value);
      const data = record[dataIndex];
      if (data?.messages) {
        const content = decodeEntities(data.messages[0].content);
        return content.toLowerCase().includes(value.toLowerCase());
      }
      return data.toString().toLowerCase().includes(value.toLowerCase());
    },
    onFilterDropdownOpenChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100);
      }
    },
    render: (value) => {
      let text = '';
      if (value) {
        text = value.toString();
      }
      if (searchedColumn === dataIndex) {
        return (
          <Highlighter
            highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
            searchWords={[searchText]}
            autoEscape
            textToHighlight={text}
          />
        );
      } else {
        return text;
      }
    },
  });

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: '70px',
      render: (_, { key }) => key,
    },
    {
      title: 'Model',
      dataIndex: 'model',
      render: (_, { model }) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {model}
        </div>
      ),
    },
    {
      title: 'Function',
      dataIndex: 'functionName',
      render: (_, { functionName }) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {functionName}
        </div>
      ),
    },
    {
      title: 'Prompt',
      dataIndex: 'prompt',
      ...getColumnSearchProps('prompt'),
      className: 'top',
      width: '50%',
      render: (_, { prompt }) => {
        if (prompt?.messages) {
          return (
            <Typography.Paragraph
              ellipsis={{
                expandable: true,
                rows: 2,
              }}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {decodeEntities(prompt.messages[0].content?.trim())}
            </Typography.Paragraph>
          );
        } else {
          return (
            <JsonView collapsed src={prompt} />
          );
        }
      },
    },
    {
      title: 'Response',
      dataIndex: 'response',
      ...getColumnSearchProps('response'),
      className: 'top',
      width: '50%',
      render: (_, { outputType, response }) => {
        if (outputType === 'function_call') {
          return (
            <JsonView collapsed src={response} />
          );
        } else {
          return (
            <Typography.Paragraph
              ellipsis={{
                expandable: true,
                rows: 2,
              }}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {response?.trim()}
            </Typography.Paragraph>
          );
        }
      },
    },
    {
      title: 'Evals',
      dataIndex: 'evals',
      className: 'top',
      fixed: 'right',
      width: 225,
      render: (_, { evaluations, humanEvaluation, key }) => (
        <>
          <Segmented
            onChange={value => setEvalType(cur => ({ ...cur, [key]: value }))}
            options={[
              {
                label: 'Human',
                value: 'human',
              },
              {
                label: 'Machine',
                value: 'machine',
              },
            ]}
          />
          {evalType[key] === 'machine' ?
            <MachineEval
              evaluations={evaluations}
            />
            :
            <EvalForm
              initialValues={humanEvaluation}
              onSave={(values) => handleSave(key, values)}
            />
          }
        </>
      )
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [
      Table.SELECTION_ALL,
    ],
  };

  const getFilename = () => {
    const dt = dayjs().format('YYYYMMDD-HHmm');
    return `training-data-${dt}.csv`;
  };

  const cleanData = (data) => {
    return data.map((d) => Object.entries(d).reduce((a, [k, v]) => {
      let val;
      if (typeof v === 'string') {
        val = v.replace(/"/g, '""');
      } else {
        val = v;
      }
      a[k] = val;
      return a;
    }, {}));
  };

  const hasSelected = selectedRowKeys.length > 0;

  return (
    <>
      {contextHolder}
      <div id="training" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', marginBottom: 16 }}>
          <div>
            <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
              Delete
            </Button>
            <span style={{ marginLeft: 8 }}>
              {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
            </span>
          </div>
          <div style={{ flex: 1 }}></div>
          <CSVLink
            data={cleanData(data)}
            filename={getFilename()}
          >
            Download
          </CSVLink>
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
