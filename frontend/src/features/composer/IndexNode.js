import { memo, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getIndexesAsync,
  selectIndexes,
  selectLoaded as selectIndexesLoaded,
} from '../indexes/indexesSlice';

export default memo(({ id, data, isConnectable }) => {

  const indexes = useSelector(selectIndexes);
  const indexesLoaded = useSelector(selectIndexesLoaded);

  const indexOptions = useMemo(() => {
    if (indexes) {
      const options = Object.values(indexes).map((x) => ({
        label: x.name,
        value: x.id,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [indexes]);

  const { selectedWorkspace } = useContext(WorkspaceContext);
  const dispatch = useDispatch();

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  useEffect(() => {
    if (selectedWorkspace && !indexesLoaded) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getIndexesAsync({ workspaceId }));
    }
  }, [indexesLoaded, selectedWorkspace]);

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const indexId = evt.target.value;
          node.data = {
            ...node.data,
            indexId,
          };
        }
        return node;
      })
    );
  };

  return (
    <>
      <div className="custom-node__header">
        Index
      </div>
      <div className="custom-node__body">
        <Select
          isConnectable={isConnectable}
          onChange={onChange}
          options={indexOptions}
          value={data.indexId}
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
