import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Handle, Position } from 'reactflow';

export default memo(({ id, data, isConnectable }) => {

  return (
    <>
      <div className="custom-node__header">
        {data.label}
      </div>
      <div className="custom-node__body">
        {data.modelId ?
          <Link to={`/models/${data.modelId}`}>{data.modelName}</Link>
          : null
        }
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </>
  );
});
