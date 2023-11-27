import { memo, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import { MappingModalInput } from '../../components/MappingModalInput';
import { SchemaModalInput } from '../../components/SchemaModalInput';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getFunctionsAsync,
  selectFunctions,
  selectLoaded as selectFunctionsLoaded,
} from '../functions/functionsSlice';
import {
  getModelsAsync,
  selectModels,
  selectLoaded as selectModelsLoaded,
} from '../models/modelsSlice';

const returnTypeOptions = [
  {
    label: 'Select',
    value: null,
  },
  {
    label: 'application/json',
    value: 'application/json',
  },
  {
    label: 'text/plain',
    value: 'text/plain',
  },
];

export default memo(({ id, data, isConnectable }) => {

  const functions = useSelector(selectFunctions);
  const functionsLoaded = useSelector(selectFunctionsLoaded);
  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);

  const functionValues = useMemo(() => Object.values(functions), [functions]);

  const { selectedWorkspace } = useContext(WorkspaceContext);
  const dispatch = useDispatch();

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      if (!functionsLoaded) {
        dispatch(getFunctionsAsync({ workspaceId }));
      }
      if (!modelsLoaded) {
        dispatch(getModelsAsync({ workspaceId }));
      }
    }
  }, [selectedWorkspace]);

  return (
    <>
      <div className="custom-node__header">
        Mapper
      </div>
      <div className="custom-node__body">
        <Select options={returnTypeOptions} optionFilterProp="label" name="Output Type" nodeId={id} value={data.returnType} />
        <SetSchema data={data} name="Output Schema" nodeId={id} />
        <SetMapper
          data={data}
          functionsLoaded={functionsLoaded}
          functions={functionValues}
          modelsLoaded={modelsLoaded}
          models={models}
          name="Mapper"
          nodeId={id}
          isConnectable={isConnectable}
        />
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </>
  );
});

function Select({ options, value, nodeId, name }) {
  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === nodeId) {
          node.data = {
            ...node.data,
            returnType: evt.target.value,
          };
        }

        return node;
      })
    );
  };

  return (
    <div className="custom-node__select">
      <div>{name}</div>
      <select className="nodrag" onChange={onChange} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SetSchema({ data, name, nodeId }) {
  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const onChange = (value) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === nodeId) {
          node.data = {
            ...node.data,
            returnTypeSchema: value,
          };
        }

        return node;
      })
    );
  };

  return (
    <div className="custom-node__select">
      <div>{name}</div>
      <SchemaModalInput
        onChange={onChange}
        buttonProps={{ size: 'small', block: true }}
        value={data.returnTypeSchema}
      />
    </div>
  );
}

function SetMapper({ data, functions, functionsLoaded, models, modelsLoaded, nodeId, name, isConnectable }) {
  const { setNodes } = useReactFlow();
  const store = useStoreApi();
  const { edges, nodeInternals } = store.getState();

  // console.log('nodeInternals:', nodeInternals);
  // console.log('edges:', edges);

  const edge = edges.find((e) => e.target === nodeId);
  // console.log('edge:', edge, nodeId);

  if (!edge) {
    return null;
  }

  const nodeSource = Array.from(nodeInternals.values()).find((n) => n.id === edge.source);
  // console.log('nodeSource:', nodeSource);

  if (!nodeSource) {
    return null;
  }

  const getFunctionReturnTypeSchema = () => {
    if (nodeSource.type !== 'functionNode' || !functionsLoaded || !modelsLoaded) {
      return null;
    }

    const { functionId } = nodeSource.data;
    const func = functions.find(f => f.id == functionId);  // use `==`
    // console.log('func:', func);
    if (!func || !func.implementations || !func.implementations.length) {
      return null;
    }

    const impl = func.implementations.find(m => m.isDefault);
    // console.log('impl:', impl);
    if (!impl) {
      return null;
    }

    const model = models[impl.modelId];
    // console.log('model:', model);
    if (!model) {
      return null;
    }
    if (model.type === 'gpt') {
      return func.returnTypeSchema;
    }

    return model.returnTypeSchema;
  };

  let sourceSchema;
  if (nodeSource.type === 'functionNode') {
    sourceSchema = getFunctionReturnTypeSchema();
  } else if (nodeSource.type === 'requestNode') {
    sourceSchema = nodeSource.data.arguments;
  }
  if (!sourceSchema) {
    return null;
  }

  const onChange = (value) => {
    console.log('value:', value);
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === nodeId) {
          node.data = {
            ...node.data,
            mappingData: value,
          };
        }
        return node;
      })
    );
  };

  return (
    <div className="custom-node__select">
      <div>{name}</div>
      <MappingModalInput
        sourceSchema={sourceSchema}
        targetSchema={data.returnTypeSchema}
        disabledMessage="Have both model and function return types been defined?"
        sourceTitle="Model Return"
        targetTitle="Function Return"
        buttonProps={{ size: 'small', block: true }}
        onChange={onChange}
        value={data.mappingData}
      />
    </div>
  );
}
