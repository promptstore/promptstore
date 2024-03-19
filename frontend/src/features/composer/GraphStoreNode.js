import { memo, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import {
  getGraphStoresAsync,
  selectGraphStores,
  selectLoaded as selectGraphStoresLoaded,
} from '../uploader/graphStoresSlice';

export default memo(({ id, data, isConnectable }) => {

  console.log('data:', data);

  const stores = useSelector(selectGraphStores);
  const storesLoaded = useSelector(selectGraphStoresLoaded);

  const graphStoreOptions = useMemo(() => {
    if (stores) {
      const options = Object.values(stores).map((s) => ({
        label: s.name,
        value: s.key,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [stores]);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const dispatch = useDispatch();

  useEffect(() => {
    if (!storesLoaded) {
      dispatch(getGraphStoresAsync());
    }
  }, [storesLoaded]);

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const graphStoreProvider = evt.target.value;
          node.data = {
            ...node.data,
            graphStoreProvider,
          };
        }
        return node;
      })
    );
  };

  return (
    <>
      <div className="custom-node__header">
        Graph Store
      </div>
      <div className="custom-node__body">
        <Select
          isConnectable={isConnectable}
          nodeId={id}
          onChange={onChange}
          options={graphStoreOptions}
          value={data.graphStoreProvider}
        />
      </div>
    </>
  );
});

function Select({ isConnectable, onChange, options, value }) {
  return (
    <div className="custom-node__select">
      <select className="nodrag" onChange={onChange} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </div>
  );
}
