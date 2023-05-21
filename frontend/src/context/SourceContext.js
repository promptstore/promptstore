import { createContext } from 'react';

const SourceContext = createContext({
  selectedSource: null,
  setSelectedSource: (state) => { },
});

export default SourceContext;
