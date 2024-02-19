import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Descriptions, Form, Input, Modal, Space, Switch, Table, Typography } from 'antd';
import { v4 as uuidv4 } from 'uuid';

import NavbarContext from '../../contexts/NavbarContext';
import UserContext from '../../contexts/UserContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { getHumanFriendlyDelta, slugify } from '../../utils';
import {
  setAdmin,
} from '../users/usersSlice';
import {
  createWorkspaceAsync,
  getWorkspaceAsync,
  handleKeyAssignmentAsync,
  inviteMembersAsync,
  revokeKeyAssignmentAsync,
  selectLoaded,
  selectWorkspaces,
  updateWorkspaceAsync,
} from './workspacesSlice';

const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

export function WorkspaceForm() {

  const [apiKey, setApiKey] = useState(null);
  const [backOnSave, setBackOnSave] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [apiSelectedRowKeys, setApiSelectedRowKeys] = useState([]);

  const loaded = useSelector(selectLoaded);
  const workspaces = useSelector(selectWorkspaces);

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [form] = Form.useForm();
  const [apiKeyForm] = Form.useForm();

  const nameValue = Form.useWatch('name', form);
  const keyValue = Form.useWatch('key', form);

  const { setNavbarState } = useContext(NavbarContext);
  const { currentUser } = useContext(UserContext);
  const { selectedWorkspace, setSelectedWorkspace } = useContext(WorkspaceContext);

  const id = location.pathname.match(/\/workspaces\/(.*)/)[1];
  const workspace = workspaces[id];
  const isNew = id === 'new';

  const [inviteMembersForm] = Form.useForm();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Workspace',
    }));
    if (!isNew) {
      dispatch(getWorkspaceAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace && isLinking) {
      setIsLinking(false);
      navigate('/apps');
    }
  }, [selectedWorkspace, isLinking]);

  useEffect(() => {
    if (backOnSave) {
      setBackOnSave(false);
      navigate('/workspaces');
    }
  }, [workspaces]);

  const data = useMemo(() => {
    if (workspace) {
      const members = workspace.members || [];
      return members.map((m) => ({
        key: m.id,
        name: m.fullName,
        email: m.email,
      }));
    }
    return [];
  }, [workspaces]);

  const apiKeyData = useMemo(() => {
    if (workspace) {
      const apiKeys = workspace.apiKeys || {};
      const userKeys = Object.values(apiKeys)
        .filter(v => v.username === currentUser.username)
        ;
      const list = Object.values(userKeys).map(v => ({
        key: v.id,
        name: v.name,
        created: v.created,
      }));
      list.sort((a, b) => a.created > b.created ? 1 : -1);
      return list;
    }
    return [];
  }, [workspaces]);

  const hasSelected = selectedRowKeys.length > 0;
  const hasApiKeysSelected = apiSelectedRowKeys.length > 0;

  const closeKeyModal = () => {
    setApiKey(null);
  };

  const handleInvite = async () => {
    const values = await inviteMembersForm.validateFields();
    if (values.invites) {
      dispatch(inviteMembersAsync({
        workspaceId: id,
        invites: values.invites?.trim().split(/\s*,\s*/),
      }));
    }
    setIsInviteModalOpen(false);
  };

  const handleInviteCancel = () => {
    setIsInviteModalOpen(false);
  };

  const handleKeyAssignment = async () => {
    const { name } = await apiKeyForm.validateFields();
    dispatch(handleKeyAssignmentAsync({ apiKey, name, workspaceId: id }));
    setApiKey(null);
    apiKeyForm.resetFields();
  };

  const linkToApps = (ev) => {
    if (!isNew) {
      setSelectedWorkspace(workspace);
      setIsLinking(true);
    }
  };

  const onCancel = () => {
    navigate('/workspaces');
  };

  const onFinish = (values) => {
    if (isNew) {
      if (!workspaces.length) {
        dispatch(setAdmin());
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
      dispatch(createWorkspaceAsync({ values }));
    } else {
      dispatch(updateWorkspaceAsync({
        id,
        values: {
          ...workspace,
          ...values,
        },
      }));
    }
    setBackOnSave(true);
  };

  const onRemoveMembers = () => {
    const members = workspace.members.filter((u) => !selectedRowKeys.includes(u.id));
    dispatch(updateWorkspaceAsync({ id, values: { ...workspace, members } }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const onSelectApiKeyChange = (newSelectedRowKeys) => {
    setApiSelectedRowKeys(newSelectedRowKeys);
  };

  const openInviteModal = () => {
    setIsInviteModalOpen(true);
  };

  const getKey = () => {
    setApiKey(uuidv4());
  };

  const revokeKey = () => {
    dispatch(revokeKeyAssignmentAsync({ workspaceId: id, ids: apiSelectedRowKeys }));
    setApiSelectedRowKeys([]);
  };

  const setKeyValue = () => {
    if (nameValue && !keyValue) {
      form.setFieldValue('key', slugify(nameValue));
    }
  };

  const columns = [
    {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      width: '250px',
    },
    {
      key: 'email',
      title: 'Email',
      dataIndex: 'email',
    },
    // {
    //   title: 'Action',
    //   key: 'action',
    //   render: (_, record) => (
    //     <Space size="middle">
    //       <Button type="text" size="small"
    //         style={{ paddingLeft: 0 }}
    //         onClick={() => onRemoveMember(record.key)}
    //       >
    //         Remove
    //       </Button>
    //     </Space>
    //   ),
    // },
  ];

  const apiKeyColumns = [
    {
      key: 'name',
      title: 'Purpose',
      dataIndex: 'name',
      width: '250px',
    },
    {
      key: 'created',
      title: 'Created',
      dataIndex: 'created',
      render: (_, { created }) => (
        <span style={{ whiteSpace: 'nowrap' }}>{getHumanFriendlyDelta(created)}</span>
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

  const apiKeyRowSelection = {
    apiSelectedRowKeys,
    onChange: onSelectApiKeyChange,
    selections: [
      Table.SELECTION_ALL,
    ],
  };

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      <Modal
        title="Invite Members"
        okText="Invite"
        open={isInviteModalOpen}
        onOk={handleInvite}
        onCancel={handleInviteCancel}
        width={800}
      >
        <div style={{ height: 300 }}>
          {loaded ?
            <Form
              form={inviteMembersForm}
            >
              <Form.Item
                name="invites"
                extra="Enter member emails as a comma-separated list"
              >
                <Input />
              </Form.Item>
            </Form>
            :
            <div>Loading...</div>
          }
        </div>
      </Modal>
      <Modal
        title="API Key"
        open={apiKey}
        okText="Save"
        onCancel={closeKeyModal}
        onOk={handleKeyAssignment}
      >
        <Form
          autoComplete="off"
          form={apiKeyForm}
          layout="vertical"
        >
          <Form.Item
            label="Purpose"
            name="name"
            rules={[
              {
                required: true,
                message: 'Please enter a purpose to use as a label',
              },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
        <Descriptions column={1} layout="vertical">
          <Descriptions.Item label="Key">
            <Typography.Text code copyable>
              {apiKey}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item>
            This will only be shown once.
          </Descriptions.Item>
        </Descriptions>
      </Modal>
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex' }}>
          <div style={{ marginLeft: 'auto' }}>
            <Space>
              <Button type="link"
                disabled={isNew}
                onClick={openInviteModal}
              >
                Invite Members
              </Button>
              <Button type="link"
                disabled={isNew}
                onClick={linkToApps}
              >
                Apps
              </Button>
            </Space>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <Form
            {...layout}
            form={form}
            name="workspace"
            autoComplete="off"
            onFinish={onFinish}
            initialValues={workspace}
          >
            {!isNew ?
              <Form.Item
                label="ID"
                name="id"
              >
                <Typography.Text code copyable>
                  {workspace.id}
                </Typography.Text>
              </Form.Item>
              : null
            }
            <Form.Item
              label="Name"
              name="name"
              rules={[
                {
                  required: true,
                  message: 'Please enter a workspace name',
                },
              ]}
            >
              <Input onBlur={setKeyValue} />
            </Form.Item>
            <Form.Item
              label="Key"
              name="key"
              rules={[
                {
                  required: true,
                  message: 'Please enter a workspace key',
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Description"
              name="description"
            >
              <TextArea autoSize={{ minRows: 3, maxRows: 14 }} />
            </Form.Item>
            {currentUser?.roles?.includes('admin') ?
              <Form.Item
                label="Public"
                name="isPublic"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              : null
            }
            <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
              <Space>
                <Button type="default" onClick={onCancel}>Cancel</Button>
                <Button type="primary" htmlType="submit">Submit</Button>
              </Space>
            </Form.Item>
            <Form.Item
              colon={false}
              label={
                <label style={{ height: 'inherit', paddingTop: 16 }}>Members :</label>
              }
              style={{ marginTop: 40 }}
            >
              <Table
                rowSelection={rowSelection}
                columns={columns}
                dataSource={data}
                pagination={false}
              />
              <div style={{ marginTop: 8 }}>
                <Button danger type="primary" size="small"
                  disabled={!hasSelected}
                  onClick={onRemoveMembers}
                >
                  Remove Members
                </Button>
                <span style={{ marginLeft: 8 }}>
                  {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
                </span>
              </div>
            </Form.Item>
            <Form.Item
              colon={false}
              label={
                <label style={{ height: 'inherit', paddingTop: 32 }}>API Keys :</label>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Table
                  rowSelection={apiKeyRowSelection}
                  columns={apiKeyColumns}
                  dataSource={apiKeyData}
                  pagination={false}
                />
                <Space>
                  <Button type="default" size="small"
                    disabled={isNew}
                    onClick={getKey}
                  >
                    Get API Key
                  </Button>
                  <Button danger type="primary" size="small"
                    disabled={isNew || !hasApiKeysSelected}
                    onClick={revokeKey}
                  >
                    Revoke API Key
                  </Button>
                  <span>
                    {hasApiKeysSelected ? `Selected ${apiSelectedRowKeys.length} items` : ''}
                  </span>
                </Space>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </div>
    </>
  );
}