import { useContext, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Space } from 'antd';

import NavbarContext from '../../contexts/NavbarContext';

import {
  getUserAsync,
  selectUsers,
  selectLoaded,
  upsertUserAsync,
} from './usersSlice';

const DEFAULT_CREDITS = 2000;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 16 },
};

export function UserForm() {

  const [form] = Form.useForm();

  const users = useSelector(selectUsers);
  const loaded = useSelector(selectLoaded);

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { setNavbarState } = useContext(NavbarContext);

  const id = location.pathname.match(/\/users\/(.*)\/edit/)[1];
  const isNew = id === 'new';
  const user = users[id];

  // console.log('user:', user);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'User',
    }));
    if (!isNew) {
      dispatch(getUserAsync(id));
    }
  }, []);

  const onCancel = () => {
    navigate('/users');
  };

  const onFinish = (values) => {
    console.log('values:', values);
    values.credits = +(values.credits || 0);
    if (isNaN(values.credits)) {
      values.credits = DEFAULT_CREDITS;
    }
    if (isNew) {
      dispatch(upsertUserAsync(values));
    } else {
      dispatch(upsertUserAsync({
        username: user.username,
        ...values,
      }));
    }
    navigate('/users');
  };

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      <div style={{ marginTop: 20 }}>
        <div style={{ marginTop: 20 }}>
          <Form
            form={form}
            {...layout}
            name="app"
            autoComplete="off"
            onFinish={onFinish}
            initialValues={user}
          >
            <Form.Item wrapperCol={{ span: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 16, alignItems: 'center' }}>
                <Link to={`/users/${id}`}>View</Link>
                <Link to={`/users`}>List</Link>
              </div>
            </Form.Item>
            <Form.Item
              label="Name"
            >
              <Form.Item
                extra="First"
                name="firstName"
                rules={[
                  {
                    required: true,
                    message: "Please enter the user's first name",
                  },
                ]}
                style={{ display: 'inline-block', marginBottom: 0, width: 'calc(50% - 8px)' }}
              >
                <Input />
              </Form.Item>
              <Form.Item
                extra="Last"
                name="lastName"
                rules={[
                  {
                    required: true,
                    message: "Please enter the user's last name",
                  },
                ]}
                style={{ display: 'inline-block', marginBottom: 0, marginLeft: 16, width: 'calc(50% - 8px)' }}
              >
                <Input />
              </Form.Item>
            </Form.Item>
            <Form.Item
              label="Email"
            >
              {user?.email}
            </Form.Item>
            <Form.Item
              label="Credits"
              name="credits"
              initialValue={2000}
              wrapperCol={{ span: 4 }}
            >
              <Input type="number" />
            </Form.Item>
            <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
              <Space>
                <Button type="default" onClick={onCancel}>Cancel</Button>
                <Button type="primary" htmlType="submit">Submit</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </div>
    </>
  );
};