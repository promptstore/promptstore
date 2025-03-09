import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Space, Table, message } from 'antd';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import { getFunctionsAsync, selectFunctions } from '../functions/functionsSlice';
import {
  deleteScenariosAsync,
  generateOutputsAsync,
  getScenariosAsync,
  selectLoading,
  selectScenarios,
  selectRunning,
} from './testScenariosSlice';

export function TestScenarios() {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const functions = useSelector(selectFunctions);
  const loading = useSelector(selectLoading);
  const running = useSelector(selectRunning);
  const scenarios = useSelector(selectScenarios);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const data = useMemo(() => {
    const list = Object.values(scenarios).map(r => ({
      key: r.id,
      name: r.name,
      functionId: r.functionId,
      testCasesCount: r.testCasesCount,
      modified: r.modified,
    }));
    list.sort((a, b) => (a.name > b.name ? 1 : -1));
    return list;
  }, [scenarios]);

  useEffect(() => {
    setNavbarState(state => ({
      ...state,
      createLink: '/test-scenarios/new',
      title: 'Test Scenarios',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getFunctionsAsync({ workspaceId }));
      dispatch(getScenariosAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => <Link to={`/test-scenarios/${record.key}`}>{text}</Link>,
    },
    {
      title: 'Semantic Function',
      dataIndex: 'semanticFunction',
      key: 'semanticFunction',
      width: 250,
      render: (_, { functionId }) => functions[functionId]?.name,
    },
    {
      title: 'Test Cases',
      dataIndex: 'testCasesCount',
      key: 'testCasesCount',
      width: 110,
    },
    {
      title: 'Last Updated',
      dataIndex: 'modified',
      key: 'modified',
      width: 125,
      render: (_, { modified }) => new Date(modified).toLocaleDateString(),
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 250,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            onClick={() => navigate(`/test-scenarios/${record.key}`)}
            style={{ paddingLeft: 0 }}
          >
            Edit
          </Button>
          <Button
            type="link"
            loading={running[record.key]}
            onClick={() => generateTestCases(record.key)}
            style={{ paddingLeft: 0 }}
          >
            Run
          </Button>
        </Space>
      ),
    },
  ];

  const generateTestCases = id => {
    dispatch(generateOutputsAsync({ id, workspaceId: selectedWorkspace.id }));
  };

  const onDelete = () => {
    dispatch(deleteScenariosAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = newSelectedRowKeys => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [Table.SELECTION_ALL],
  };

  const hasSelected = selectedRowKeys.length > 0;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
          Delete
        </Button>
        <span style={{ marginLeft: 8 }}>{hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}</span>
      </div>
      <Table columns={columns} dataSource={data} loading={loading} rowSelection={rowSelection} />
    </div>
  );
}
