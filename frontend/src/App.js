import { Suspense, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import useLocalStorageState from 'use-local-storage-state';
import { ReactFlowProvider } from 'reactflow';
import isEmpty from 'lodash.isempty';

import CookieManager from './CookieManager';
import ErrorMessage from './components/ErrorMessage';
import { AuthProvider } from './contexts/AuthContext';
import NavbarContext from './contexts/NavbarContext';
import UserContext from './contexts/UserContext';
import WorkspaceContext from './contexts/WorkspaceContext';
import {
  getCurrentUserAsync,
  selectCurrentUser,
  selectAuthStatusChecked,
} from './features/users/usersSlice';
import {
  getWorkspacesAsync,
  selectWorkspaces,
} from './features/workspaces/workspacesSlice';

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

  const [selectedWorkspace, setSelectedWorkspace] = useLocalStorageState('workspace', { defaultValue: null });

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

  useEffect(() => {
    if (process.env.REACT_APP_NO_AUTH === 'true') {
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
    } else if (process.env.REACT_APP_FIREBASE_API_KEY) {
      console.log('Using firebase');
      let unsubscribe;
      import('./config/firebase.js')
        .then(({ default: auth }) => {
          // console.log('auth:', auth);
          // Adds an observer for changes to the signed-in user's ID token, 
          // which includes sign-in, sign-out, and token refresh events. This 
          // method has the same behavior as `firebase.auth.Auth.onAuthStateChanged` 
          // had prior to 4.0.0.
          // `onAuthStateChanged` - Prior to 4.0.0, this triggered the observer 
          // when users were signed in, signed out, or when the user's ID token 
          // changed in situations such as token expiry or password change. After 
          // 4.0.0, the observer is only triggered on sign-in or sign-out.
          // current version - ^10.1.0
          unsubscribe = auth.onIdTokenChanged(async (user) => {
            // console.log('user:', user);
            if (user) {
              const accessToken = await user.getIdToken();
              // console.log('accessToken:', accessToken);
              if (accessToken) {
                setToken({ accessToken });
                setCurrentUser((cur) => {
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
        setCurrentUser((current) => current ? { ...current, ...currentUsr } : currentUsr);
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

  const Loading = () => (
    <div style={{ margin: '20px 40px' }}>Loading...</div>
  );

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
  return (
    <Suspense fallback={<Loading />}>
      <ConfigProvider
        theme={{
          algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
        }}
      >
        <AuthProvider>
          <UserContext.Provider value={userContextValue}>
            <WorkspaceContext.Provider value={workspaceContextValue}>
              <NavbarContext.Provider value={navbarContextValue}>
                <ReactFlowProvider>
                  <ErrorMessage />
                  <RouterProvider router={router({ currentUser, isDarkMode, selectedWorkspace })} />
                </ReactFlowProvider>
              </NavbarContext.Provider>
            </WorkspaceContext.Provider>
          </UserContext.Provider>
        </AuthProvider>
      </ConfigProvider>
    </Suspense>
  );
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
