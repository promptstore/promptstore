import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input } from 'antd';

import { useAuth } from '../../contexts/AuthContext';
import {
  upsertUserAsync,
  selectUsers,
} from '../../features/users/usersSlice';

import background from '../../images/promptstore-background.png';

export default function Login() {

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const users = useSelector(selectUsers);

  const { currentUser, login, setError } = useAuth();

  useEffect(() => {
    if (currentUser && users && Object.values(users).find(u => u?.email === currentUser.email)) {
      navigate('/');
    }
  }, [currentUser, users]);

  const handleFormSubmit = async (values) => {
    const { email, password } = values;
    try {
      setError('');
      setLoading(true);
      const userCredential = await login(email, password);
      console.log('userCredential:', userCredential);
      const u = userCredential.user;
      const [firstName, lastName] = (u.displayName || '').split(' ');
      const user = {
        username: u.email,
        fullName: u.displayName,
        firstName,
        lastName,
        email: u.email,
        photoURL: u.photoURL,
      };
      dispatch(upsertUserAsync({ user }));
    } catch (e) {
      setError('Failed to login');
    }
    setLoading(false);
  };

  return (
    <div style={{ background: `url(${background}) no-repeat center top fixed`, backgroundSize: 'cover', display: 'flex', alignItems: 'center', height: '100vh' }}>
      <Card
        title="Login to your account"
        style={{ height: 390, width: 500, marginLeft: '20%' }}
      >
        <Form
          layout="vertical"
          onFinish={handleFormSubmit}
        >
          <Form.Item
            label="email"
            name="email"
            rules={[
              {
                required: true,
                message: 'Please enter an email address',
              },
            ]}
          >
            <Input autoComplete="email" />
          </Form.Item>
          <Form.Item
            label="password"
            name="password"
            rules={[
              {
                required: true,
                message: 'Please enter a password',
              },
            ]}
          >
            <Input autoComplete="current-password" type="password" />
          </Form.Item>
          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'end' }}>
              <Button disabled={loading} type="primary" htmlType="submit">Login</Button>
            </div>
          </Form.Item>
          <Form.Item>
            <Link
              to="/register"
            >
              Don't have an account? Register
            </Link>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
