import { Suspense, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { StyleProvider } from '@ant-design/cssinjs';
import { ReactFlowProvider } from 'reactflow';
import isEmpty from 'lodash.isempty';
import useLocalStorageState from 'use-local-storage-state';
import useSessionStorageState from 'use-session-storage-state';

import CookieManager from './CookieManager';
import ErrorMessage from './components/ErrorMessage';
import { AuthProvider } from './contexts/AuthContext';
import { AuthProvider as OidcAuthProvider, useAuth as useOidcAuth } from 'react-oidc-context';
import authConfig from './config/auth';
import NavbarContext from './contexts/NavbarContext';
import UserContext from './contexts/UserContext';
import WorkspaceContext from './contexts/WorkspaceContext';
import { getCurrentUserAsync, selectCurrentUser, selectAuthStatusChecked } from './features/users/usersSlice';
import { getWorkspacesAsync, selectWorkspaces } from './features/workspaces/workspacesSlice';

import defaultUser from './defaultUser';
import router from './router';
import { onTokenExpiry, onTokenRefresh, renewToken, setToken } from './http';

import './App.css';
import 'instantsearch.css/themes/satellite.css';

const { defaultAlgorithm, darkAlgorithm } = theme;

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useLocalStorageState('darkMode', { defaultValue: false });
  const [navbarState, setNavbarState] = useState({});
  const [ready, setReady] = useState(0);

  const [selectedWorkspace, setSelectedWorkspace] = useSessionStorageState('workspace', {
    defaultValue: null,
  });

  const navbarContextValue = { isDarkMode, navbarState, setNavbarState, setIsDarkMode };
  const userContextValue = { currentUser, setCurrentUser };
  const workspaceContextValue = { selectedWorkspace, setSelectedWorkspace };

  const authStatusChecked = useSelector(selectAuthStatusChecked);
  const currentUsr = useSelector(selectCurrentUser);
  const workspaces = useSelector(selectWorkspaces);

  const dispatch = useDispatch();

  /* Keycloak SSO ***********/

  // useEffect(() => {
  //   dispatch(getCurrentUserAsync());

  //   onTokenExpiry(() => {
  //     window.location.replace('/login');
  //   });

  //   onTokenRefresh((token) => {
  //     setCurrentUser((current) => ({
  //       ...current,
  //       ...token,
  //     }));
  //   });

  //   // renew token every 20 min
  //   const interval = setInterval(renewToken, 1200000);
  //   return () => clearInterval(interval);
  // }, []);

  // useEffect(() => {
  //   if (!ready && currentUsr) {
  //     const { accessToken, refreshToken } = currentUsr;
  //     setToken({ accessToken, refreshToken });
  //     setCurrentUser((current) => ({ ...(current || {}), ...currentUsr }));
  //     setReady(true);
  //   }
  // }, [currentUsr]);

  /* ***********/

  useEffect(() => {
    if (authStatusChecked && !currentUsr) {
      setReady(2);
    }
  }, [authStatusChecked]);

  const authProvider = process.env.REACT_APP_AUTH_PROVIDER || 'none';

  useEffect(() => {
    if (authProvider === 'cognito') {
      // Cognito auth is handled by react-oidc-context AuthProvider.
      // Token setup happens in the CognitoAuthBridge component below.
      return;
    }
    if (authProvider === 'none' || process.env.REACT_APP_NO_AUTH === 'true') {
      const email = CookieManager.get('accessToken');
      if (email) {
        console.log('Using anon account:', email);
        setToken({ accessToken: encodeURIComponent(email) });
        const currentUser = CookieManager.get('currentUser');
        setCurrentUser(JSON.parse(currentUser));
        setReady(1);
      } else if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    } else if (authProvider === 'firebase' || process.env.REACT_APP_FIREBASE_API_KEY) {
      console.log('Using firebase');
      let unsubscribe;
      import('./config/firebase.js').then(({ default: auth }) => {
        unsubscribe = auth.onIdTokenChanged(async user => {
          if (user) {
            const accessToken = await user.getIdToken();
            if (accessToken) {
              setToken({ accessToken });
              setCurrentUser(cur => {
                if (cur) {
                  return { ...cur, ...user };
                }
                return user;
              });
            }
          }
        });
      });

      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } else if (process.env.REACT_APP_PROMPTSTORE_API_KEY) {
      console.log('Using service account');
      setToken({ accessToken: process.env.REACT_APP_PROMPTSTORE_API_KEY });
      setCurrentUser(defaultUser);
      dispatch(getWorkspacesAsync());
      setReady(1);
    }
  }, []);

  useEffect(() => {
    if (ready === 0 && currentUser) {
      if (!currentUsr) {
        dispatch(getCurrentUserAsync());
      } else {
        setCurrentUser(current => (current ? { ...current, ...currentUsr } : currentUsr));
        dispatch(getWorkspacesAsync());
        setReady(1);
      }
    }
  }, [currentUser, currentUsr, ready]);

  useEffect(() => {
    if (ready === 1) {
      if (selectedWorkspace && !isEmpty(workspaces)) {
        if (!Object.values(workspaces).find(w => w.id === selectedWorkspace.id)) {
          setSelectedWorkspace(null);
        }
      }
      setReady(2);
    }
  }, [ready, selectedWorkspace, workspaces]);

  const Loading = () => <div style={{ margin: '20px 40px' }}>Loading...</div>;

  // if (ready < 2 && !authStatusChecked) {
  //   return (
  //     <div style={{ margin: '20px 40px' }}>Authenticating...</div>
  //   );
  // }
  // if (ready < 2) {
  //   return (
  //     <Loading />
  //   );
  // }
  const appContent = (
    <UserContext.Provider value={userContextValue}>
      <WorkspaceContext.Provider value={workspaceContextValue}>
        <NavbarContext.Provider value={navbarContextValue}>
          <ReactFlowProvider>
            <StyleProvider>
              <ErrorMessage />
              <RouterProvider router={router({ currentUser, isDarkMode, selectedWorkspace })} />
            </StyleProvider>
          </ReactFlowProvider>
        </NavbarContext.Provider>
      </WorkspaceContext.Provider>
    </UserContext.Provider>
  );

  return (
    <Suspense fallback={<Loading />}>
      <ConfigProvider
        theme={{
          algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
        }}
      >
        {authProvider === 'cognito' ? (
          <OidcAuthProvider {...authConfig}>
            <AuthProvider>
              <CognitoAuthBridge
                setToken={setToken}
                setCurrentUser={setCurrentUser}
                dispatch={dispatch}
              />
              {appContent}
            </AuthProvider>
          </OidcAuthProvider>
        ) : (
          <AuthProvider>
            {appContent}
          </AuthProvider>
        )}
      </ConfigProvider>
    </Suspense>
  );
}

/**
 * Bridge component that lives inside the OIDC AuthProvider
 * and syncs the OIDC auth state to the App-level state.
 */
function CognitoAuthBridge({ setToken, setCurrentUser, dispatch }) {
  const oidcAuth = useOidcAuth();

  useEffect(() => {
    if (oidcAuth.isAuthenticated && oidcAuth.user) {
      const idToken = oidcAuth.user.id_token;
      if (idToken) {
        setToken({ accessToken: idToken });
      }
      const profile = oidcAuth.user.profile || {};
      const name = profile.name || profile.email || profile.preferred_username || 'Unknown User';
      const email = profile.email;
      const groups = profile['cognito:groups'] || [];
      const [firstName, lastName] = (name || '').split(' ');
      // Set currentUser but NOT ready — let the App useEffect at line 143
      // handle dispatching getCurrentUserAsync and getWorkspacesAsync
      setCurrentUser({
        email,
        username: email,
        fullName: name,
        firstName: firstName || '',
        lastName: lastName || '',
        roles: groups.length > 0 ? groups : ['admin'],
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`,
        displayName: name,
      });
    } else if (!oidcAuth.isLoading && !oidcAuth.isAuthenticated) {
      // OIDC finished loading but user is not authenticated (expired session, etc.)
      // Redirect to login so they can re-authenticate
      if (window.location.pathname !== '/login' && window.location.pathname !== '/callback') {
        window.location.replace('/login');
      }
    }
  }, [oidcAuth.isAuthenticated, oidcAuth.isLoading, oidcAuth.user]);

  // Re-set token when it renews silently
  useEffect(() => {
    if (oidcAuth.user?.id_token) {
      setToken({ accessToken: oidcAuth.user.id_token });
    }
  }, [oidcAuth.user?.id_token]);

  return null;
}

// function PrivateRoute({ children, rules, ...rest }) {

//   const blockingRule = rules.find(r => !r.condition);

//   return (
//     <Route {...rest}
//       render={({ location }) =>
//         !blockingRule ?
//           children
//           :
//           <Redirect to={{
//             pathname: blockingRule.redirect,
//             state: {
//               from: location,
//               message: blockingRule.message,
//             }
//           }} />
//       }
//     />
//   );
// }

export default App;
