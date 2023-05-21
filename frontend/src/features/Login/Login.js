import { useNavigate } from 'react-router-dom';
// import env from 'react-dotenv';
import useOAuth2 from './useOAuth2';

const env = {
  APP_ID: '***REMOVED***',
  AUTHORIZE_URL: 'https://oauth.canto.global/oauth/api/oauth2/authorize',
};

const Login = () => {

  const navigate = useNavigate();

  const { data, loading, error, getAuth } = useOAuth2({
    navigate,
    appId: env.APP_ID,
    authorizeUrl: env.AUTHORIZE_URL,
    redirectUrl: `${document.location.origin}/callback`,
    tokenUrl: `/api/token`,
  });

  const isLoggedIn = Boolean(data && data.access_token); // or whatever...

  if (error) {
    return <div>Error</div>;
  }

  if (loading) {
    return <div style={{ margin: '24px' }}>Loading...</div>;
  }

  if (isLoggedIn) {
    return <pre style={{ margin: '24px' }}>{JSON.stringify(data)}</pre>;
  }

  return (
    <button style={{ margin: '24px' }} type="button" onClick={() => getAuth()}>
      Login
    </button>
  );
};

export default Login;
