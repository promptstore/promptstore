import { memo } from 'react';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

export default memo(({ id, data, isConnectable }) => {

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const onChange = (ev, varName) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const value = ev.target.value;
          node.data = {
            ...node.data,
            [varName]: value,
          };
        }
        return node;
      })
    );
  };

  return (
    <>
      <div className="custom-node__header">
        Loop over
      </div>
      <div className="custom-node__body">
        <div>Loop variable</div>
        <Input
          isConnectable={isConnectable}
          onChange={(ev) => onChange(ev, 'loopVar')}
          value={data.loopVar || ''}
        />
        <div style={{ marginTop: 8 }}>Aggregation variable</div>
        <Input
          isConnectable={isConnectable}
          onChange={(ev) => onChange(ev, 'aggregationVar')}
          value={data.aggregationVar || ''}
        />
        <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
        <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
      </div>
    </>
  );
});

function Input({ isConnectable, onChange, value }) {
  return (
    <div className="custom-node__input">
      <input className="nodrag" onChange={onChange} value={value} />
    </div>
  );
}
