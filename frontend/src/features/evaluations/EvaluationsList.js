import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Table, message } from 'antd';
import useLocalStorageState from 'use-local-storage-state';
import { v4 as uuidv4 } from 'uuid';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  deleteEvaluationsAsync,
  getEvaluationsAsync,
  runEvaluationAsync,
  selectEvaluations,
  selectLoading,
} from './evaluationsSlice';

export function EvaluationsList() {

  const [correlationId, setCorrelationId] = useState({});
  const [page, setPage] = useLocalStorageState('evaluations-list-page', { defaultValue: 1 });
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const evaluations = useSelector(selectEvaluations);

  const data = useMemo(() => {
    const list = Object.values(evaluations).map((t) => ({
      key: t.id,
      name: t.name,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [evaluations]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/evaluations/new',
      title: 'Evaluations',
    }));
  }, []);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 3,
      });
    }
  }, [location]);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getEvaluationsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    const eval_ = Object.values(evaluations)
      .find(t => t.correlationId === correlationId[t.id]);
    if (eval_) {
      setCorrelationId((curr) => ({ ...curr, [eval_.id]: null }));
    }
  }, [correlationId, evaluations]);

  useEffect(() => {
    if (selectedKey && !correlationId[selectedKey]) {
      messageApi.info({
        content: 'Evaluation run complete',
        duration: 3,
      });
      setSelectedKey(null);
    }
  }, [correlationId, selectedKey]);

  const onDelete = () => {
    dispatch(deleteEvaluationsAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const runEvaluation = (key) => {
    const correlationId = uuidv4();
    dispatch(runEvaluationAsync({
      id: key,
      correlationId,
      workspaceId: selectedWorkspace.id,
    }));
    setCorrelationId((curr) => ({
      ...curr,
      [key]: correlationId,
    }));
    setSelectedKey(key);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/evaluations/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 225,
      render: (_, record) => (
        <Space wrap>
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/evaluations/${record.key}`)}
          >
            Edit
          </Button>
          <Button type="link"
            loading={!!correlationId[record.key]}
            style={{ paddingLeft: 0 }}
            onClick={() => runEvaluation(record.key)}
          >
            Run Now
          </Button>
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/evaluation-runs/${record.key}`)}
          >
            Past Runs
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

  function TableView({ data, loading }) {

    const columns = useMemo(() => {
      if (data && data.length) {
        return Object.keys(data[0]).map((k, i) => ({
          title: k,
          dataIndex: k,
          key: k,
        }));
      }
    }, [data]);

    const dataSource = useMemo(() => {
      if (data) {
        return data.map((row, i) => ({ ...row, key: i }));
      }
      return null;
    }, [data]);

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        pagination={false}
      />
    );
  }

  return (
    <>
      {contextHolder}
      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
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
          pagination={{
            current: page,
            onChange: (page, pageSize) => setPage(page),
          }}
        />
      </div>
    </>
  );
};
