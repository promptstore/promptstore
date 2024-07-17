import { memo, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getAgentsAsync,
  selectAgents,
  selectLoaded as selectAgentsLoaded,
} from '../agents/agentsSlice';

export default memo(({ id, data, isConnectable }) => {

  const agents = useSelector(selectAgents);
  const agentsLoaded = useSelector(selectAgentsLoaded);

  const agentOptions = useMemo(() => {
    if (agents) {
      const options = Object.values(agents).map((f) => ({
        label: f.name,
        value: f.id,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [agents]);

  const { selectedWorkspace } = useContext(WorkspaceContext);
  const dispatch = useDispatch();

  useEffect(() => {
    if (selectedWorkspace && !agentsLoaded) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getAgentsAsync({ workspaceId }));
    }
  }, [selectedWorkspace, agentsLoaded]);

  return (
    <>
      <div className="custom-node__header">
        Agent
      </div>
      <div className="custom-node__body">
        <Select
          options={agentOptions}
          nodeId={id}
          isConnectable={isConnectable}
          value={data.agentId}
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
          const agentId = evt.target.value;
          const opt = options.find(opt => opt.value == agentId);
          let name = opt.label;
          node.data = {
            ...node.data,
            agentId,
            name,
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
