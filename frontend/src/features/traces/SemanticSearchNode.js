import { memo, useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { Handle, Position } from 'reactflow';

import { SearchModal } from '../../components/SearchModal';
import NavbarContext from '../../contexts/NavbarContext';

export default memo(({ id, data, isConnectable }) => {

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState({});

  const { isDarkMode } = useContext(NavbarContext);

  const onSearchCancel = () => {
    setSearchModalOpen(false);
    setSelectedIndex({});
  };

  const openSearch = (index) => {
    setSelectedIndex(index);
    setSearchModalOpen(true);
  };

  return (
    <>
      <SearchModal
        container={document.body}
        onCancel={onSearchCancel}
        open={searchModalOpen}
        indexName={selectedIndex.name}
        theme={isDarkMode ? 'dark' : 'light'}
        titleField="text"
        indexParams={selectedIndex.params}
      />
      <div className="custom-node__header">
        <div style={{ display: 'flex' }}>
          <div>semantic-search</div>
          <div style={{ flex: 1 }}></div>
          <Link onClick={() => openSearch(data.index)}>Debug</Link>
        </div>
      </div>
      <div className="custom-node__body">
        <Link to={`/indexes/${data.index.id}`}>{data.index.name}</Link>
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </>
  );
});
