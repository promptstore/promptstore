import { memo, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getDataSourcesAsync,
  selectDataSources,
  selectLoaded as selectDataSourcesLoaded,
} from '../dataSources/dataSourcesSlice';

export default memo(({ id, data, isConnectable }) => {

  const dataSources = useSelector(selectDataSources);
  const dataSourcesLoaded = useSelector(selectDataSourcesLoaded);

  const dataSourceOptions = useMemo(() => {
    if (dataSources) {
      const options = Object.values(dataSources).map((s) => ({
        label: s.name,
        value: s.id,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [dataSources]);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const { selectedWorkspace } = useContext(WorkspaceContext);
  const dispatch = useDispatch();

  useEffect(() => {
    if (selectedWorkspace && !dataSourcesLoaded) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getDataSourcesAsync({ workspaceId }));
    }
  }, [selectedWorkspace, dataSourcesLoaded]);

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const dataSourceId = evt.target.value;
          node.data = {
            ...node.data,
            dataSourceId,
          };
        }
        return node;
      })
    );
  };

  return (
    <>
      <div className="custom-node__header">
        Data Source
      </div>
      <div className="custom-node__body">
        <Select
          isConnectable={isConnectable}
          nodeId={id}
          onChange={onChange}
          options={dataSourceOptions}
          value={data.dataSourceId}
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
