import { Handle, Position, useStore } from 'reactflow';

const connectionNodeIdSelector = (state) => state.connectionNodeId;

export default function CustomNode({ id, data }) {

  // console.log('data:', data);

  const connectionNodeId = useStore(connectionNodeIdSelector);

  const isConnecting = !!connectionNodeId;
  const isTarget = connectionNodeId && connectionNodeId !== id;
  let label;
  if (isTarget) {
    label = 'Drop here';
  } else if (data?.label) {
    label = data.label;
  } else {
    label = 'Drag to connect';
  }

  return (
    <div className="customNode">
      <div className="nodeDragHandle">
        <svg viewBox="0 0 20 20" width="10">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
        </svg>
      </div>
      <div
        className="customNodeBody"
        style={{
          borderStyle: isTarget ? 'dashed' : 'solid',
          backgroundColor: isTarget ? '#ffcce3' : '#ccd9f6',
        }}
      >
        {/* If handles are conditionally rendered and not present initially, you need to update the node internals https://reactflow.dev/docs/api/hooks/use-update-node-internals/ */}
        {/* In this case we don't need to use useUpdateNodeInternals, since !isConnecting is true at the beginning and all handles are rendered initially. */}
        {!isConnecting && (
          <Handle className="customHandle" position={Position.Right} type="source" />
        )}

        <Handle
          className="customHandle"
          position={Position.Left}
          type="target"
          isConnectableStart={false}
        />
        {label}
      </div>
    </div>
  );
}
