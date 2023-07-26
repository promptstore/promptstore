import { memo } from 'react';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';

import { ReturnTypeMappingModalInput } from '../../components/ReturnTypeMappingModalInput';
import { SchemaModalInput } from '../../components/SchemaModalInput';

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

  return (
    <>
      <div className="custom-node__header">
        Mapper
      </div>
      <div className="custom-node__body">
        <Select options={returnTypeOptions} optionFilterProp="label" name="Output Type" nodeId={id} value={data.returnType} />
        <SetSchema data={data} name="Output Schema" nodeId={id} />
        <SetMapper data={data} name="Mapper" nodeId={id} isConnectable={isConnectable} />
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

function SetMapper({ data, nodeId, name, isConnectable }) {
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

  // const node = Array.from(nodeInternals.values()).find((n) => n.id === nodeId);
  // console.log('node:', node);

  // if (!node) {
  //   return null;
  // }

  const nodeSource = Array.from(nodeInternals.values()).find((n) => n.id === edge.source);
  // console.log('nodeSource:', nodeSource);

  if (!nodeSource || nodeSource.type !== 'functionNode') {
    return null;
  }

  const { functionId, functions } = nodeSource.data;

  // use `==`
  const func = functions.find((f) => f.id == functionId);
  // console.log('func:', func);

  if (!func) {
    return null;
  }

  const index = func.implementations.findIndex((impl) => impl.isDefault);
  // console.log('index:', index);

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
      <ReturnTypeMappingModalInput
        implementationsValue={func.implementations}
        index={index}
        modelsLoaded={true}
        models={data.models}
        returnTypeSchema={data.returnTypeSchema}
        buttonProps={{ size: 'small', block: true }}
        onChange={onChange}
        value={data.mappingData}
      />
      {/* <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} /> */}
    </div>
  );
}
