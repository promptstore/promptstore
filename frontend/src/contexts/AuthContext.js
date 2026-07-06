import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth as useOidcAuth } from 'react-oidc-context';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import CookieManager from '../CookieManager';

const DEFAULT_USER = {
  email: 'test.account@promptstore.dev',
  roles: ['admin'],
  fullName: 'Test Account',
  firstName: 'Test',
  lastName: 'Account',
  photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=TA',
  username: 'test.account@promptstore.dev',
  displayName: 'Test Account',
};

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {

  const [currentUser, setCurrentUser] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Returns the OIDC auth object when running under react-oidc-context
  // (Cognito), or undefined otherwise — useContext returns undefined when
  // there is no surrounding OidcAuthProvider.
  const oidcAuth = useOidcAuth();

  async function register(email, password) {
    const { default: auth } = await import('../config/firebase.js');
    return await createUserWithEmailAndPassword(auth, email, password);
  }

  async function login(email, password) {
    const { default: auth } = await import('../config/firebase.js');
    return await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    const authProvider = process.env.REACT_APP_AUTH_PROVIDER || 'none';
    if (authProvider === 'cognito') {
      const { performLogout } = await import('../utils/cognitoAuth.js');
      return await performLogout(oidcAuth || {});
    }
    if (process.env.REACT_APP_NO_AUTH === 'true' || !process.env.REACT_APP_FIREBASE_API_KEY) {
      CookieManager.delete('accessToken');
      CookieManager.delete('currentUser');
      setCurrentUser(null);
      return;
    }
    const { default: auth } = await import('../config/firebase.js');
    return await signOut(auth);
  }

  async function updateUserProfile(user, profile) {
    await import('../config/firebase.js');
    await updateProfile(user, profile);
  }

  useEffect(() => {
    const authProvider = process.env.REACT_APP_AUTH_PROVIDER || 'none';
    if (authProvider === 'cognito') {
      // Cognito auth is handled by react-oidc-context and CognitoAuthBridge.
      // Don't set a default user here — let CognitoAuthBridge provide the real user.
      setLoading(false);
      return;
    }
    const email = CookieManager.get('accessToken');
    if (process.env.REACT_APP_NO_AUTH === 'true' && email) {
      const currentUser = CookieManager.get('currentUser');
      setCurrentUser(JSON.parse(currentUser));
      setLoading(false);
    } else {
      if (process.env.REACT_APP_FIREBASE_API_KEY) {
        let unsubscribe;
        import('../config/firebase.js')
          .then(({ default: auth }) => {
            unsubscribe = auth.onIdTokenChanged((user) => {
              setCurrentUser(user);
              setLoading(false);
            });
          });

        return () => {
          if (unsubscribe) {
            unsubscribe();
          }
        };
      }
      setCurrentUser(DEFAULT_USER);
      setLoading(false);
    }
  }, []);

  const value = {
    currentUser,
    error,
    setError,
    login,
    register,
    logout,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
