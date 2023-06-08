import { memo } from 'react';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';
import { SchemaModalInput } from '../../components/SchemaModalInput';

export default memo(({ id, data, isConnectable }) => {

  return (
    <>
      <div className="custom-node__header">
        Request
      </div>
      <div className="custom-node__body">
        <Arguments value={data.arguments} nodeId={id} isConnectable={isConnectable} />
      </div>
    </>
  );
});

function Arguments({ value, nodeId, isConnectable }) {
  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const onChange = (value) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === nodeId) {
          node.data = {
            ...node.data,
            arguments: value,
          };
        }

        return node;
      })
    );
  };

  return (
    <div className="custom-node__select">
      <SchemaModalInput onChange={onChange} value={value} buttonProps={{ size: 'small', block: true }} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </div>
  );
}