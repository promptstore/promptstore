import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

const DEFAULT_USER = {
  email: 'test.account@promptstore.dev',
  roles: ['admin'],
  fullName: 'Test Account',
  firstName: 'Test',
  lastName: 'Account',
  photoURL: 'https://avatars.dicebear.com/api/gridy/0.5334164767352256.svg',
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

  async function register(email, password) {
    const { default: auth } = await import('../config/firebase.js');
    return await createUserWithEmailAndPassword(auth, email, password);
  }

  async function login(email, password) {
    const { default: auth } = await import('../config/firebase.js');
    return await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    const { default: auth } = await import('../config/firebase.js');
    return await signOut(auth);
  }

  async function updateUserProfile(user, profile) {
    await import('../config/firebase.js');
    await updateProfile(user, profile);
  }

  useEffect(() => {
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
