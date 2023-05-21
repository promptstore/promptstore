import { createContext } from 'react';

const UserContext = createContext({
  currentUser: null,
  setCurrentUser: (state) => { },
});

export default UserContext;
