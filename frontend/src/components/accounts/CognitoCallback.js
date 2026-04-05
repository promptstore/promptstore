import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

export default function CognitoCallback() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate('/', { replace: true });
    } else if (auth.error) {
      console.error('Authentication error:', auth.error);
      navigate('/login', { replace: true });
    }
  }, [auth.isAuthenticated, auth.error, navigate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
        <p style={{ marginTop: 20 }}>Completing login...</p>
      </div>
    </div>
  );
}
