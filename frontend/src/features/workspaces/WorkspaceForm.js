import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Descriptions, Form, Input, Modal, Select, Space, Switch, Table, Typography } from 'antd';
import { v4 as uuidv4 } from 'uuid';

import NavbarContext from '../../contexts/NavbarContext';
import UserContext from '../../contexts/UserContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getUsersAsync,
  selectLoaded as selectUsersLoaded,
  selectUsers,
  setAdmin,
} from '../users/usersSlice';
import {
  createWorkspaceAsync,
  getWorkspaceAsync,
  handleKeyAssignmentAsync,
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
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loaded = useSelector(selectLoaded);
  const workspaces = useSelector(selectWorkspaces);
  const users = useSelector(selectUsers);
  const usersLoaded = useSelector(selectUsersLoaded);

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

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
  }, [workspace]);

  const userOptions = useMemo(() => {
    return Object.values(users).map((u) => ({
      label: u.email,
      value: u.id,
    }));
  }, [users]);

  const hasSelected = selectedRowKeys.length > 0;

  const closeKeyModal = () => {
    setApiKey(null);
  };

  const handleKeyAssignment = () => {
    dispatch(handleKeyAssignmentAsync({ apiKey, workspaceId: id }));
    setApiKey(null);
  };

  const handleInvite = async () => {
    const values = await inviteMembersForm.validateFields();
    const members =
      values.members
        .map((id) => users[id])
        .map(({ id, fullName, email, username }) => ({
          id,
          fullName,
          email,
          username,
        }));
    dispatch(updateWorkspaceAsync({ id, values: { ...workspace, members } }));
    setIsInviteModalOpen(false);
  };

  const handleInviteCancel = () => {
    setIsInviteModalOpen(false);
  };

  const getKey = () => {
    setApiKey(uuidv4());
  };

  const revokeKey = () => {
    dispatch(revokeKeyAssignmentAsync({ workspaceId: id }));
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
    navigate('/workspaces');
  };

  const onRemoveMembers = () => {
    const members = workspace.members.filter((u) => !selectedRowKeys.includes(u.id));
    dispatch(updateWorkspaceAsync({ id, values: { ...workspace, members } }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const openInviteModal = () => {
    if (!usersLoaded) {
      dispatch(getUsersAsync());
    }
    setIsInviteModalOpen(true);
  };

  const columns = [
    {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      width: '200px',
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

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
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
          {loaded && usersLoaded ?
            <Form
              form={inviteMembersForm}
              initialValues={{ members: workspace?.members?.map(({ id }) => id) }}
            >
              <Form.Item
                name="members"
              >
                <Select allowClear
                  mode="multiple"
                  options={userOptions}
                  optionFilterProp="label"
                />
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
        onCancel={closeKeyModal}
        onOk={handleKeyAssignment}
      >
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
            name="workspace"
            autoComplete="off"
            onFinish={onFinish}
            initialValues={workspace}
          >
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
                colon={false}
                label="Public?"
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
              <Table rowSelection={rowSelection} columns={columns} dataSource={data} />
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
              label="API"
            >
              <Space>
                <Button type="default" size="small"
                  disabled={isNew}
                  onClick={getKey}
                >
                  Get API Key
                </Button>
                <Button type="default" size="small"
                  disabled={isNew}
                  onClick={revokeKey}
                >
                  Revoke API Key
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </div>
    </>
  );
}