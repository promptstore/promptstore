import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { Button, Space, Table, Tag, message } from 'antd';

import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import {
  deletePromptSetsAsync,
  getPromptSetsAsync,
  selectLoading,
  selectPromptSets,
} from './promptSetsSlice';

export function PromptSetsList() {

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loading = useSelector(selectLoading);
  const promptSets = useSelector(selectPromptSets);

  const data = useMemo(() => {
    const list = Object.values(promptSets).map((promptSet) => ({
      key: promptSet.id,
      name: promptSet.name,
      skill: promptSet.skill,
      tags: promptSet.tags,
      isTemplate: promptSet.isTemplate,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [promptSets]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  const location = useLocation();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/prompt-sets/new',
      title: 'Prompts',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getPromptSetsAsync({ workspaceId: selectedWorkspace.id }));
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
    dispatch(deletePromptSetsAsync({ ids: selectedRowKeys }));
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
          <Link to={`/prompt-sets/${key}`}>{name}</Link>
        </div>
      )
    },
    {
      title: 'Skill',
      dataIndex: 'skill',
      render: (_, { skill }) => <span>{skill}</span>
    },
    {
      title: 'Template',
      dataIndex: 'template',
      render: (_, { isTemplate }) => <span>{isTemplate ? 'Y' : ''}</span>
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      width: '100%',
      render: (_, { tags = [] }) => (
        <Space size={[0, 8]} wrap>
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
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
        <Table rowSelection={rowSelection} columns={columns} dataSource={data} loading={loading} />
      </div>
    </>
  );
};
