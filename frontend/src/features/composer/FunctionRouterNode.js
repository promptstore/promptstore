import { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ id, data, isConnectable }) => {

  return (
    <>
      <div className="custom-node__header">
        Function Router
      </div>
      <div className="custom-node__body">
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </>
  );
});
