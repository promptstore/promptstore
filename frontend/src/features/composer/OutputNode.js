import { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ id, data, isConnectable }) => {

  return (
    <>
      <div className="custom-node__header">
        Output
      </div>
      <div className="custom-node__body">
      </div>
      <Handle type="target" position={Position.Left} id="target" />
    </>
  );
});
