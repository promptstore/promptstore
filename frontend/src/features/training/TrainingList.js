import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { Button, Form, Space, Table, Typography, message } from 'antd';
import { CSVLink } from 'react-csv';
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
} from './trainingSlice';

import './TrainingList.css';

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

export function TrainingList() {

  const [page, setPage] = useLocalStorageState('training-list-page', { defdaultValue: 1 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const trainingData = useSelector(selectTrainingData);

  const data = useMemo(() => {
    const list = Object.values(trainingData).map((row) => {
      const outputType = row.outputType;
      let response;
      if (outputType === 'function_call') {
        response = row.modelOutput.function_call;
      } else {
        response = row.modelOutputText;
      }
      return {
        key: row.id,
        prompt: row.modelInput,
        outputType,
        response,
        model: row.model,
        functionName: row.functionName,
      };
    });
    list.sort((a, b) => a.key > b.key ? 1 : -1);
    return list;
  }, [trainingData]);

  // console.log('data:', data);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  const location = useLocation();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Datasets',
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
        duration: 3,
      });
    }
  }, [location]);

  const onDelete = () => {
    dispatch(deleteTrainingDataAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

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
      className: 'top',
      render: (_, { prompt }) => (
        <Typography.Paragraph
          ellipsis={{
            expandable: true,
            rows: 2,
          }}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {decodeEntities(prompt.messages[0].content.trim())}
        </Typography.Paragraph>
      ),
    },
    {
      title: 'Response',
      dataIndex: 'response',
      className: 'top',
      render: (_, { outputType, response }) => {
        if (outputType === 'function_call') {
          return <JsonView src={response} />;
        } else {
          return (
            <Typography.Paragraph
              ellipsis={{
                expandable: true,
                rows: 2,
              }}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {response.trim()}
            </Typography.Paragraph>
          );
        }
      },
    },
    {
      title: 'Evals',
      dataIndex: 'evals',
      width: 225,
      render: (record) => <div>&nbsp;</div>
      // render: (_, { outputType, response }) => {
      //   if (outputType === 'function_call') {
      //     return <JsonView src={response} />;
      //   } else {
      //     return (
      //       <div style={{ whiteSpace: 'pre-wrap' }}>
      //         {response}
      //       </div>
      //     );
      //   }
      // },
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
