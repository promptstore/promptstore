import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Modal,
  Segmented,
  Space,
  Table,
  message,
} from 'antd';
import useLocalStorageState from 'use-local-storage-state';
import get from 'lodash.get';

import { JsonView } from '../../components/JsonView';
import NavbarContext from '../../contexts/NavbarContext';
import {
  getWorkspacesAsync,
  selectWorkspaces,
} from '../workspaces/workspacesSlice';
import {
  confirmMirrorAsync,
  deleteMirrorsAsync,
  getMirrorsAsync,
  runMirrorAsync,
  selectLoading,
  selectMirrors,
  selectPreview,
  selectRunning,
} from './mirrorsSlice';

import './MirrorsList.css';

const conflictOptions = [
  {
    label: 'Leave',
    value: 'leave',
  },
  {
    label: 'Replace',
    value: 'replace',
  },
  {
    label: 'Concat',
    value: 'concat',
  },
];

const versionOptions = [
  {
    label: 'No Version',
    value: 'no_version',
  },
  {
    label: 'Version',
    value: 'version',
  },
];

export function MirrorsList() {

  const [isModalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useLocalStorageState('mirrors-list-page', { defaultValue: 1 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [conflictActions, setConflictActions] = useState({});
  const [versionActions, setVersionActions] = useState({});
  const [selectedMirrorKey, setSelectedMirrorKey] = useState(null);
  const [dryRun, setDryRun] = useState(false);

  const loading = useSelector(selectLoading);
  const mirrors = useSelector(selectMirrors);
  const preview = useSelector(selectPreview);
  const running = useSelector(selectRunning);
  const workspaces = useSelector(selectWorkspaces);

  // console.log('preview:', preview);
  // console.log('workspaces:', workspaces);

  const data = useMemo(() => {
    const list = Object.values(mirrors).map((row) => {
      return {
        key: row.id,
        name: row.name,
      };
    });
    list.sort((a, b) => a.key > b.key ? 1 : -1);
    return list;
  }, [mirrors]);

  // console.log('data:', data);

  const previewColumns = [
    {
      title: 'Changes',
      dataIndex: 'change',
      render: (_, { change, diff }) => (
        <div style={{ minWidth: 250 }}>
          {change}
          {/* <div style={{ paddingLeft: 70 }}>
            {diff}
          </div> */}
        </div>
      )
    },
    {
      title: dryRun ? 'New' : 'Merged',
      dataIndex: 'source',
    },
    {
      title: 'Original',
      dataIndex: 'target',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      fixed: 'right',
      width: 225,
      render: (_, { conflictKey, key, versionKey }) => {
        if (conflictKey) {
          return (
            <Segmented
              disabled={!dryRun}
              size="small"
              options={conflictOptions}
              onChange={(value) => {
                setConflictActions(cur => ({
                  ...cur,
                  [conflictKey]: value,
                }));
              }}
              value={conflictActions[conflictKey]}
            />
          );
        } else if (versionKey) {
          return (
            <Segmented
              disabled={!dryRun}
              size="small"
              options={versionOptions}
              onChange={(value) => {
                setVersionActions(cur => ({
                  ...cur,
                  [versionKey]: value,
                }));
              }}
              value={versionActions[versionKey]}
            />
          );
        } else if (key === 'updates') {
          return (
            <Segmented
              disabled={!dryRun}
              size="small"
              options={conflictOptions}
              onChange={(value) => {
                const keys = {};
                for (const v of Object.values(preview.changes)) {
                  for (const val of Object.values(v)) {
                    for (const u of val) {
                      for (const c of u.conflicts) {
                        const change = c.join('.');
                        keys[`${u.target.id}:${change}`] = value;
                      }
                    }
                  }
                }
                setConflictActions(keys);
              }}
            />
          );
        } else if (key === 'updates-prompt-sets') {
          return (
            <Segmented
              disabled={!dryRun}
              size="small"
              options={versionOptions}
              onChange={(value) => {
                const keys = {};
                for (const v of Object.values(preview.changes)) {
                  for (const [key, val] of Object.entries(v)) {
                    if (key === 'prompt-sets') {
                      for (const u of val) {
                        keys[u.target.id] = value;
                      }
                    }
                  }
                }
                setVersionActions(keys);
              }}
            />
          );
        }
      }
    },
  ];

  const previewData = useMemo(() => {
    if (preview && Object.keys(workspaces).length) {
      return [
        {
          key: 'adds',
          change: 'Adds',
          children: Object.entries(preview.adds).map(([k, v]) => ({
            key: 'adds-workspace-' + k,
            change: workspaces[k].name,
            children: Object.entries(v).map(([key, val]) => {
              const list = [...val];
              list.sort((a, b) => a.name < b.name ? -1 : 1);
              return {
                key: 'adds-' + key,
                change: key + ` (${val.length} items)`,
                children: list.map(a => ({
                  key: key + '-' + a.key,
                  change: a.name,
                  source: (
                    <JsonView collapsed src={a} />
                  ),
                })),
              };
            }),
          })),
        },
        {
          key: 'updates',
          change: 'Updates',
          children: Object.entries(preview.changes).map(([k, v]) => ({
            key: 'updates-workspace-' + k,
            change: workspaces[k].name,
            children: Object.entries(v).map(([key, val]) => {
              return {
                key: 'updates-' + key,
                change: key + ` (${val.length} items)`,
                children: val.map((u, i) => {
                  let children;
                  if (u.conflicts.length) {
                    children = u.conflicts.map((c, j) => {
                      const change = c.join('.');
                      return {
                        key: 'updates-' + key + '-' + i + '-' + j,
                        change,
                        source: get(u.source, c),
                        target: get(u.target, c),
                        conflictKey: `${u.target.id}:${change}`,
                      };
                    });
                  }
                  let conflicts;
                  if (u.conflicts.length) {
                    conflicts = <span> ({u.conflicts.length + ' conflicts'})</span>;
                  }
                  return {
                    key: 'updates-' + key + '-' + i,
                    change: (
                      <div style={{ paddingLeft: 70 }}>
                        <div>{u.source.name}{conflicts}</div>
                      </div>
                    ),
                    source: (
                      <JsonView collapsed src={u.source} />
                    ),
                    target: (
                      <JsonView collapsed src={u.target} />
                    ),
                    diff: (
                      <JsonView collapsed src={u.diff} />
                    ),
                    children,
                    versionKey: key === 'prompt-sets' ? u.target.id : undefined,
                  };
                }),
              };
            }),
          })),
        }
      ]
    }
  }, [preview, workspaces]);

  // console.log('previewData:', previewData);

  const { setNavbarState } = useContext(NavbarContext);

  const dispatch = useDispatch();

  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: '/mirrors/new',
      title: 'Mirrors',
    }));
    dispatch(getWorkspacesAsync());
    dispatch(getMirrorsAsync());
  }, []);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 5,
      });
    }
  }, [location]);

  const onCancel = () => {
    setModalOpen(false);
    setDryRun(false);
    setSelectedMirrorKey(null);
  };

  const onDelete = () => {
    dispatch(deleteMirrorsAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const runMirror = (mirrorId) => {
    dispatch(runMirrorAsync({ mirrorId }));
    setSelectedMirrorKey(mirrorId);
    setDryRun(true);
    setModalOpen(true);
  };

  const confirmMirror = () => {
    dispatch(confirmMirrorAsync({
      mirrorId: selectedMirrorKey,
      conflictActions,
      dryRun,
    }));
    if (!dryRun) {
      setModalOpen(false);
      setSelectedMirrorKey(null);
    }
    setDryRun(false);
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: '70px',
      render: (_, { key }) => key,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, { key, name }) => (
        <div style={{ minWidth: 250 }}>
          <Link to={`/mirrors/${key}`}>{name}</Link>
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
            onClick={() => navigate(`/mirrors/${record.key}`)}
          >
            Edit
          </Button>
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => runMirror(record.key)}
          >
            Run
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
    <>
      {contextHolder}
      <Modal
        onCancel={onCancel}
        onOk={confirmMirror}
        okText={dryRun ? 'Dry Run' : 'Make Permanent'}
        okButtonProps={{
          danger: !dryRun,
        }}
        open={isModalOpen}
        width={'75%'}
      >
        <Table
          id="preview-table"
          columns={previewColumns}
          dataSource={previewData}
          loading={running}
          pagination={false}
        />
      </Modal>
      <div id="mirrors-list" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', marginBottom: 16 }}>
          <div>
            <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
              Delete
            </Button>
            <span style={{ marginLeft: 8 }}>
              {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
            </span>
          </div>
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
