import { memo, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  getModelsAsync,
  selectModels,
  selectLoaded as selectModelsLoaded,
  selectLoading as selectModelsLoading,
} from '../models/modelsSlice';
import {
  getEmbeddingProvidersAsync,
  selectEmbeddingProviders,
  selectLoaded as selectEmbeddingProvidersLoaded,
} from '../uploader/embeddingSlice';

export default memo(({ id, data, isConnectable }) => {

  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);
  const modelsLoading = useSelector(selectModelsLoading);
  const providers = useSelector(selectEmbeddingProviders);
  const providersLoaded = useSelector(selectEmbeddingProvidersLoaded);

  const { selectedWorkspace } = useContext(WorkspaceContext);

  const embeddingModelOptions = useMemo(() => {
    const list = Object.values(models)
      .filter(m => m.type === 'embedding')
      .map(m => ({
        label: m.name,
        value: m.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    list.unshift({ label: 'Select', value: -1 });
    return list;
  }, [models]);

  const providerOptions = useMemo(() => {
    if (providers) {
      const options = Object.values(providers).map((p) => ({
        label: p.name,
        value: p.key,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [providers]);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const dispatch = useDispatch();

  useEffect(() => {
    if (!providersLoaded) {
      dispatch(getEmbeddingProvidersAsync());
    }
  }, [providersLoaded]);

  useEffect(() => {
    if (!modelsLoaded) {
      dispatch(getModelsAsync({ workspaceId: selectedWorkspace.id, type: 'embedding' }));
    }
  }, [modelsLoaded]);

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const modelId = evt.target.value;
          console.log('modelId:', modelId);
          console.log('models:', models);
          const model = models[modelId];
          node.data = {
            ...node.data,
            embeddingModel: {
              provider: model.provider,
              model: model.key,
              id: modelId,
            },
          };
        }
        return node;
      })
    );
  };

  return (
    <>
      <div className="custom-node__header">
        Embedding
      </div>
      <div className="custom-node__body">
        <Select
          isConnectable={isConnectable}
          nodeId={id}
          onChange={onChange}
          options={embeddingModelOptions}
          value={data.embeddingModel?.id}
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
