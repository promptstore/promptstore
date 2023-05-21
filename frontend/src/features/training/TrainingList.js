import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { Button, Table, message } from 'antd';
import { CSVLink } from 'react-csv';
import * as dayjs from 'dayjs';

import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import {
  deleteTrainingDataAsync,
  getTrainingDataAsync,
  selectLoading,
  selectTrainingData,
} from './trainingSlice';

import './TrainingList.css';

export function TrainingList() {

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const trainingData = useSelector(selectTrainingData);

  const data = useMemo(() => {
    const list = Object.values(trainingData).map((row) => ({
      key: row.id,
      prompt: row.prompt,
      response: row.response,
    }));
    list.sort((a, b) => a.key > b.key ? 1 : -1);
    return list;
  }, [trainingData]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  const location = useLocation();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Training Set',
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
      render: (_, { key }) => <span>{key}</span>
    },
    {
      title: 'Prompt',
      dataIndex: 'prompt',
      width: '50%',
      className: "top",
      render: (_, { prompt }) => <span>{prompt}</span>
    },
    {
      title: 'Response',
      dataIndex: 'response',
      width: '50%',
      className: "top",
      render: (_, { response }) => <span>{response}</span>
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
        <Table rowSelection={rowSelection} columns={columns} dataSource={data} loading={loading} />
      </div>
    </>
  );
};
