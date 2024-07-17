import { useCallback } from 'react';
import { EdgeLabelRenderer, useStore, getStraightPath } from 'reactflow';

import { getEdgeParams } from '../../utils/ReactFlowUtils';

function FloatingEdge({ id, source, target, markerEnd, style, data }) {

  const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
  const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
  });

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 10,
            // everything inside EdgeLabelRenderer has no pointer events by default
            // if you have an interactive element, set pointer-events: all
            pointerEvents: 'all',
            backgroundColor: 'rgb(245, 245, 245)',
            zIndex: 1001,
          }}
          className="nodrag nopan"
        >
          {data?.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default FloatingEdge;
