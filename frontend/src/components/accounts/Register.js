import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input } from 'antd';

import { useAuth } from '../../contexts/AuthContext';
import {
  upsertUserAsync,
  selectUsers,
} from '../../features/users/usersSlice';

import background from '../../images/promptstore-background-blank.png';

const DEFAULT_CREDITS = 2000;

export default function Register() {

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const users = useSelector(selectUsers);

  const { currentUser, register, setError, updateUserProfile } = useAuth();

  useEffect(() => {
    if (users && currentUser) {
      const user = Object.values(users).find(u => u.email === currentUser.email);
      // console.log('user:', user);
      if (user) {
        try {
          updateUserProfile(currentUser, { displayName: user.fullName });
          navigate('/profile');
        } catch (err) {
          console.error(err);
        }
      }
    }
  }, [currentUser, users]);

  const handleFormSubmit = async (values) => {
    const { email, firstName, lastName, password, confirmPassword } = values;
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    try {
      setError('');
      setLoading(true);
      await register(email, password);
      let displayName = firstName;
      if (lastName) {
        displayName += ' ' + lastName;
      }
      const user = {
        username: email,
        fullName: displayName,
        firstName,
        lastName,
        email,
        credits: DEFAULT_CREDITS,
      };
      dispatch(upsertUserAsync({ user }));
    } catch (e) {
      console.error(e);
      setError('Failed to register');
    }
    setLoading(false);
  }

  return (
    <div style={{ background: `url(${background}) no-repeat center bottom`, backgroundSize: 'cover', display: 'flex', alignItems: 'center', height: '100vh' }}>
      <Card
        title="Register your account"
        style={{ height: 564, width: 500, marginLeft: '20%' }}
      >
        <Form
          layout="vertical"
          onFinish={handleFormSubmit}
        >
          <Form.Item style={{ display: 'flex', alignItems: 'end' }}>
            <Form.Item
              label="first name"
              name="firstName"
              placeholder="First name"
              rules={[
                {
                  required: true,
                  message: 'Please enter a first name',
                },
              ]}
              style={{ display: 'inline-block', width: 'calc(50% - 4px)', margin: 0 }}
            >
              <Input autoComplete="given-name" />
            </Form.Item>
            <Form.Item
              label="last name"
              name="lastName"
              placeholder="Last name"
              style={{ display: 'inline-block', width: 'calc(50% - 4px)', margin: '1px 0 0 8px' }}
            >
              <Input autoComplete="family-name" />
            </Form.Item>
          </Form.Item>
          <Form.Item
            label="email"
            name="email"
            placeholder="Email address"
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
            placeholder="Password"
            rules={[
              {
                required: true,
                message: 'Please enter a password',
              },
            ]}
          >
            <Input autoComplete="new-password" type="password" />
          </Form.Item>
          <Form.Item
            label="confirm password"
            name="confirmPassword"
            placeholder="Password"
            rules={[
              {
                required: true,
                message: 'Please enter a password',
              },
            ]}
          >
            <Input autoComplete="new-password" type="password" />
          </Form.Item>
          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'end' }}>
              <Button disabled={loading} type="primary" htmlType="submit">Register</Button>
            </div>
          </Form.Item>
          <Form.Item>
            <Link
              to="/login"
            >
              Already have an account? Login
            </Link>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
