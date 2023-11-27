import { memo, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getToolsAsync,
  selectTools,
  selectLoaded as selectToolsLoaded,
} from '../agents/toolsSlice';

export default memo(({ id, data, isConnectable }) => {

  const tools = useSelector(selectTools);
  const toolsLoaded = useSelector(selectToolsLoaded);

  const toolOptions = useMemo(() => {
    if (tools) {
      const options = Object.values(tools).map((t) => ({
        label: t.name,
        value: t.key,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [tools]);

  const { selectedWorkspace } = useContext(WorkspaceContext);
  const dispatch = useDispatch();

  useEffect(() => {
    if (selectedWorkspace && !toolsLoaded) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getToolsAsync({ workspaceId }));
    }
  }, [selectedWorkspace, toolsLoaded]);

  return (
    <>
      <div className="custom-node__header">
        Tool
      </div>
      <div className="custom-node__body">
        <Select
          options={toolOptions}
          nodeId={id}
          isConnectable={isConnectable}
          value={data.toolId}
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
          const toolId = evt.target.value;
          const opt = options.find(opt => opt.value == toolId);
          let toolName = opt.label;
          node.data = {
            ...node.data,
            toolId,
            toolName,
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
