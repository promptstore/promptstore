import { memo } from 'react';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

export default memo(({ id, data, isConnectable }) => {

  const functionOptions = data.functions.map((f) => ({
    label: f.name,
    value: f.id,
  }));
  functionOptions.unshift({ label: 'Select', value: null });

  return (
    <>
      <div className="custom-node__header">
        Semantic Function
      </div>
      <div className="custom-node__body">
        <Select options={functionOptions} nodeId={id} isConnectable={isConnectable} value={data.functionId} />
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
          node.data = {
            ...node.data,
            functionId: evt.target.value,
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