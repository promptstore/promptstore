import { memo, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getCompositionsAsync,
  selectCompositions,
  selectLoaded as selectCompositionsLoaded,
} from '../composer/compositionsSlice';

export default memo(({ id, data, isConnectable }) => {

  const compositions = useSelector(selectCompositions);
  const compositionsLoaded = useSelector(selectCompositionsLoaded);

  const compositionOptions = useMemo(() => {
    if (compositions) {
      const options = Object.values(compositions)
        .filter((c) => c.id !== data.parentCompositionId)
        .map((c) => ({
          label: c.name,
          value: c.id,
        }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [compositions]);

  const { selectedWorkspace } = useContext(WorkspaceContext);
  const dispatch = useDispatch();

  useEffect(() => {
    if (selectedWorkspace && !compositionsLoaded) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getCompositionsAsync({ workspaceId }));
    }
  }, [selectedWorkspace, compositionsLoaded]);

  return (
    <>
      <div className="custom-node__header">
        Sub-composition
      </div>
      <div className="custom-node__body">
        <Select
          options={compositionOptions}
          nodeId={id}
          isConnectable={isConnectable}
          value={data.compositionId}
        />
      </div>
    </>
  );
});

function Select({ options, value, nodeId, isConnectable }) {
  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === nodeId) {
          const compositionId = evt.target.value;
          const opt = options.find(opt => opt.value == compositionId);
          let compositionName = opt.label;
          node.data = {
            ...node.data,
            compositionId,
            compositionName,
          };
        }
        return node;
      })
    );
  };

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
