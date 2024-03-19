import { memo, useMemo } from 'react';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

export default memo(({ id, data, isConnectable }) => {

  const varOptions = useMemo(() => {
    if (data.vars) {
      const options = data.vars.map((x) => ({
        label: x.name,
        value: x.id,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
    return [];
  }, [data]);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const loopVar = evt.target.value;
          node.data = {
            ...node.data,
            loopVar,
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
        <Select
          isConnectable={isConnectable}
          onChange={onChange}
          options={varOptions}
          value={data.loopVar}
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
