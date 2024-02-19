import { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ id, data, isConnectable }) => {

  return (
    <>
      <div style={{ fontSize: '12px', padding: '10px 0', textAlign: 'center' }}>
        {data.label}
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
    </>
  );
});
