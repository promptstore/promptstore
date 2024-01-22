import { useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Table, message } from 'antd';
import * as dayjs from 'dayjs';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { formatPercentage } from '../../utils';

import {
  getEvaluationRunsAsync,
  selectEvaluationRuns,
  selectLoading,
} from './evaluationRunsSlice';

export function EvalRuns() {

  const [page, setPage] = useLocalStorageState('evaluation-runs-list-page', { defaultValue: 1 });

  const loading = useSelector(selectLoading);
  const runs = useSelector(selectEvaluationRuns);

  const data = useMemo(() => {
    const list = Object.values(runs).map((r) => ({
      key: r.evaluationId + '-' + r.runDate,
      name: r.name,
      runDate: r.runDate,
      evaluationId: r.evaluationId,
      criterion: r.criterion,
      numberTests: r.numberTests,
      percentPassed: r.percentPassed,
    }));
    list.sort((a, b) => a.runDate > b.runDate ? -1 : 1);
    return list;
  }, [runs]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Evaluation Runs',
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
      dispatch(getEvaluationRunsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { evaluationId, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/evaluation-runs/${evaluationId}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Criterion',
      dataIndex: 'criterion',
    },
    {
      title: 'Run Date',
      dataIndex: 'runDate',
      render: (_, { runDate }) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {dayjs(runDate).format('YYYY-MM-DD HH:mm:ss')}
        </div>
      )
    },
    {
      title: 'Number Tests',
      dataIndex: 'numberTests',
    },
    {
      title: 'Pass Rate',
      dataIndex: 'percentPassed',
      render: (_, { percentPassed }) => formatPercentage(percentPassed, 0),
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
            onClick={() => navigate(`/evaluation-runs/${record.evaluationId}`)}
          >
            View
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <div style={{ marginTop: 20 }}>
        <Table
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
