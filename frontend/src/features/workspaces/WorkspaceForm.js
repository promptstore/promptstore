import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Modal, Select, Space, Table } from 'antd';

import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import UserContext from '../../context/UserContext';
import {
  getUsersAsync,
  selectLoaded as selectUsersLoaded,
  selectUsers,
} from '../users/usersSlice';
import {
  createWorkspaceAsync,
  getWorkspaceAsync,
  updateWorkspaceAsync,
  selectLoaded,
  selectWorkspaces,
} from './workspacesSlice';

const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

export function WorkspaceForm() {

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
  const { selectedWorkspace, setSelectedWorkspace } = useContext(WorkspaceContext);
  const { currentUser } = useContext(UserContext);

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
        key: m.username,
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
      const { id, fullName, email, username } = currentUser;
      const owner = {
        id,
        fullName,
        email,
        username,
        isOwner: true,
      };
      dispatch(createWorkspaceAsync({
        values: {
          ...values,
          members: [owner],
        },
      }));
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
    const members = workspace.members.filter((u) => selectedRowKeys.indexOf(u.id) === -1);
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
      >
        {usersLoaded ?
          <Form
            form={inviteMembersForm}
            initialValues={{ members: workspace.members?.map(({ id }) => id) }}
          >
            <Form.Item
              name="members"
            >
              <Select allowClear
                mode="multiple"
                options={userOptions}
              />
            </Form.Item>
          </Form>
          :
          <div>Loading...</div>
        }
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
          </Form>
        </div>
      </div>
    </>
  );
}