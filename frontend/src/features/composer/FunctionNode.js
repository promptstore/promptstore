import { memo, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getFunctionsAsync,
  selectFunctions,
  selectLoaded as selectFunctionsLoaded,
} from '../functions/functionsSlice';

export default memo(({ id, data, isConnectable }) => {

  const functions = useSelector(selectFunctions);
  const functionsLoaded = useSelector(selectFunctionsLoaded);

  const functionOptions = useMemo(() => {
    if (functions) {
      const options = Object.values(functions).map((f) => ({
        label: f.name,
        value: f.id,
      }));
      options.unshift({ label: 'Select', value: null });
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      return options;
    }
  }, [functions]);

  const { selectedWorkspace } = useContext(WorkspaceContext);
  const dispatch = useDispatch();

  useEffect(() => {
    if (selectedWorkspace && !functionsLoaded) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getFunctionsAsync({ workspaceId }));
    }
  }, [selectedWorkspace, functionsLoaded]);

  return (
    <>
      <div className="custom-node__header">
        Semantic Function
      </div>
      <div className="custom-node__body">
        <Select
          options={functionOptions}
          nodeId={id}
          isConnectable={isConnectable}
          value={data.functionId}
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
          const functionId = evt.target.value;
          const opt = options.find(opt => opt.value == functionId);
          let functionName = opt.label;
          node.data = {
            ...node.data,
            functionId,
            functionName,
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
