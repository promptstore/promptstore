import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Handle, Position } from 'reactflow';

export default memo(({ id, data, isConnectable }) => {

  return (
    <>
      <div className="custom-node__header">
        <div style={{ display: 'flex' }}>
          {data.label}
          <div style={{ flex: 1 }}></div>
          <Link to={`/design/${data.promptSetId}`}>Debug</Link>
        </div>
      </div>
      <div className="custom-node__body">
        <Link to={`/prompt-sets/${data.promptSetId}`}>{data.promptSetName}</Link>
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </>
  );
});
