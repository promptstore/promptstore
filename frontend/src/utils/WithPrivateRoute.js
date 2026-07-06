import { Navigate } from "react-router-dom";
import { useAuth as useOidcAuth } from "react-oidc-context";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

import { useAuth } from "../contexts/AuthContext";

const authProvider = process.env.REACT_APP_AUTH_PROVIDER || 'none';

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
    <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
  </div>
);

const WithPrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  // Always call the hook (rules of hooks); it returns undefined when there is
  // no surrounding OidcAuthProvider (i.e. non-Cognito modes).
  const oidcAuth = useOidcAuth();

  if (authProvider === 'cognito') {
    // While OIDC is resolving the session, show a spinner rather than
    // rendering protected content — otherwise the home page flashes before
    // we know whether the user is authenticated.
    if (!oidcAuth || oidcAuth.isLoading) {
      return <Loading />;
    }
    if (!oidcAuth.isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    return children;
  }

  if (!process.env.REACT_APP_FIREBASE_API_KEY) {
    return children;
  }

  if (currentUser) {
    return children;
  }

  return <Navigate to="/login" replace />;
};

export default WithPrivateRoute;
