import { memo, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getTransformationsAsync,
  selectTransformations,
  selectLoaded as selectTransformationsLoaded,
} from '../transformations/transformationsSlice';

export default memo(({ id, data, isConnectable }) => {

  const transformations = useSelector(selectTransformations);
  const transformationsLoaded = useSelector(selectTransformationsLoaded);

  const transformationOptions = useMemo(() => {
    if (transformations) {
      const options = Object.values(transformations).map((t) => ({
        label: t.name,
        value: t.id,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [transformations]);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const { selectedWorkspace } = useContext(WorkspaceContext);
  const dispatch = useDispatch();

  useEffect(() => {
    if (selectedWorkspace && !transformationsLoaded) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getTransformationsAsync({ workspaceId }));
    }
  }, [selectedWorkspace, transformationsLoaded]);

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const transformationId = evt.target.value;
          node.data = {
            ...node.data,
            transformationId,
          };
        }
        return node;
      })
    );
  };

  return (
    <>
      <div className="custom-node__header">
        Transformation
      </div>
      <div className="custom-node__body">
        <Select
          isConnectable={isConnectable}
          nodeId={id}
          onChange={onChange}
          options={transformationOptions}
          value={data.transformationId}
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
