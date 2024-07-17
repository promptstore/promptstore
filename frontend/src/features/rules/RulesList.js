import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Space, Table } from 'antd';
import useLocalStorageState from 'use-local-storage-state';
import { v4 as uuidv4 } from 'uuid';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  deleteRulesAsync,
  deployRuleAsync,
  getRulesAsync,
  selectLoading,
  selectRules,
} from './rulesSlice';

export function RulesList() {

  const [correlationId, setCorrelationId] = useState({});
  const [page, setPage] = useLocalStorageState('rules-list-page', { defaultValue: 1 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const rules = useSelector(selectRules);

  const data = useMemo(() => {
    const list = Object.values(rules).map(r => ({
      key: r.id,
      name: r.name,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [rules]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/rules/new',
      title: 'Rulesets',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getRulesAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    const rule = Object.values(rules)
      .find(r => correlationId[r.id] && r.correlationId === correlationId[r.id]);
    if (rule) {
      setCorrelationId((curr) => ({ ...curr, [rule.id]: null }));
    }
  }, [rules]);

  const deployRule = (id) => {
    const rule = rules[id];
    if (rule) {
      const correlationId = uuidv4();
      const rulesetId = rule.rulesetId;
      dispatch(deployRuleAsync({ correlationId, id, rulesetId }));
      setCorrelationId((curr) => ({ ...curr, [id]: correlationId }));
    }
  };

  const onDelete = () => {
    dispatch(deleteRulesAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/rules/${key}`}>{name}</Link>
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
            onClick={() => navigate(`/rules/${record.key}`)}
            style={{ paddingLeft: 0 }}
          >
            Edit
          </Button>
          <Button type="link"
            loading={correlationId[record.key]}
            onClick={() => deployRule(record.key)}
            style={{ paddingLeft: 0 }}
          >
            Deploy
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

  return (
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
  );

}