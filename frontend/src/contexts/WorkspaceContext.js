import { createContext } from 'react';

const WorkspaceContext = createContext({
  selectedWorkspace: null,
  setSelectedWorkspace: (state) => { },
});

export default WorkspaceContext;
