import React, { useEffect, useState } from 'react';
import { UITypes } from 'ui-predicate-core';
import { UIPredicate } from 'ui-predicate-react';
import { v4 as uuidv4 } from 'uuid';

import { deepDiffMapper, updateKeys, validateAST } from '../../utils';

import LogicalTypes from './LogicalTypes';
import MyTargets from './MyTargets';
import {
  ColorArgument,
  DateArgument,
  NumericArgument,
  TextArgument,
  getFeatureArgument,
} from './arguments';

const getDefaultColumns = (targetValues) => ({
  operators: [
    {
      operator_id: 'is',
      label: 'is',
      argumentType_id: 'smallString'
    },
    {
      operator_id: 'contains',
      label: 'contains',
      argumentType_id: 'smallString'
    },
    {
      operator_id: 'lessThan',
      label: 'is less than',
      argumentType_id: 'number'
    },
    {
      operator_id: 'lessThanInclusive',
      label: 'is less than or equal to',
      argumentType_id: 'number'
    },
    {
      operator_id: 'equal',
      label: 'is equal to',
      argumentType_id: 'number'
    },
    {
      operator_id: 'notEqual',
      label: 'is not equal to',
      argumentType_id: 'number'
    },
    {
      operator_id: 'greaterThan',
      label: 'is greater than',
      argumentType_id: 'number'
    },
    {
      operator_id: 'greaterThanInclusive',
      label: 'is greater than or equal to',
      argumentType_id: 'number'
    },
    {
      operator_id: 'is_date',
      label: 'is',
      argumentType_id: 'datepicker'
    },
    {
      operator_id: 'isBrighterThan',
      label: 'is brighter than',
      argumentType_id: 'colorpicker'
    },
    {
      operator_id: 'isDarkerThan',
      label: 'is darker than',
      argumentType_id: 'colorpicker'
    },
    {
      operator_id: 'is_color',
      label: 'is',
      argumentType_id: 'colorpicker'
    },
    {
      operator_id: 'is_value',
      label: 'is value',
      argumentType_id: 'feature'
    },
    {
      operator_id: 'before',
      label: 'before',
      argumentType_id: 'event'
    },
    {
      operator_id: 'after',
      label: 'after',
      argumentType_id: 'event'
    },
    {
      operator_id: 'at_least',
      label: 'at least',
      argumentType_id: 'event'
    },
    {
      operator_id: 'within_last',
      label: 'within last',
      argumentType_id: 'event'
    },
    {
      operator_id: 'within',
      label: 'within',
      argumentType_id: 'event'
    },
    {
      operator_id: 'following',
      label: 'following',
      argumentType_id: 'event'
    },
    {
      operator_id: 'preceding',
      label: 'preceding',
      argumentType_id: 'event'
    },
  ],
  types: [
    {
      type_id: 'number',
      operator_ids: ['equal', 'notEqual', 'lessThan', 'lessThanInclusive', 'greaterThan', 'greaterThanInclusive']
    },
    {
      type_id: 'int',
      operator_ids: ['equal', 'notEqual', 'lessThan', 'lessThanInclusive', 'greaterThan', 'greaterThanInclusive']
    },
    {
      type_id: 'double',
      operator_ids: ['equal', 'notEqual', 'lessThan', 'lessThanInclusive', 'greaterThan', 'greaterThanInclusive']
    },
    {
      type_id: 'bigint',
      operator_ids: ['equal', 'notEqual', 'lessThan', 'lessThanInclusive', 'greaterThan', 'greaterThanInclusive']
    },
    {
      type_id: 'decimal',
      operator_ids: ['equal', 'notEqual', 'lessThan', 'lessThanInclusive', 'greaterThan', 'greaterThanInclusive']
    },
    {
      type_id: 'string',
      operator_ids: ['contains', 'is']
    },
    {
      type_id: 'tag',
      operator_ids: ['contains', 'is', 'is_value']
    },
    {
      type_id: 'datetime',
      operator_ids: ['is_date']
    },
    {
      type_id: 'date',
      operator_ids: ['is_date']
    },
    {
      type_id: 'boolean',
      operator_ids: ['is']
    },
    {
      type_id: 'color',
      operator_ids: ['isBrighterThan', 'isDarkerThan', 'is_color']
    },
    {
      type_id: 'feature',
      operator_ids: ['is_value']
    },
    {
      type_id: 'event',
      operator_ids: ['before', 'after', 'at_least', 'within_last', 'within', 'following', 'preceding']
    }
  ],
  logicalTypes: [
    {
      logicalType_id: 'any',
      label: 'Any'
    },
    {
      logicalType_id: 'all',
      label: 'All'
    },
    {
      logicalType_id: 'none',
      label: 'None'
    }
  ],
  argumentTypes: [
    {
      argumentType_id: 'colorpicker',
      component: ColorArgument
    },
    {
      argumentType_id: 'datepicker',
      component: DateArgument
    },
    {
      argumentType_id: 'number',
      component: NumericArgument
    },
    {
      argumentType_id: 'smallString',
      component: TextArgument
    },
    {
      argumentType_id: 'feature',
      component: getFeatureArgument(targetValues)
    }
  ]
});

const defaultRule = {
  logicalType_id: 'all',
  predicates: [
    {
      target_id: 'empty',
      operator_id: 'is',
      type_id: 'string',
    }
  ],
};

const emptyTarget = {
  target_id: 'empty',
  label: 'Select',
  type_id: 'string',
  attr_type: null,
};

const defaultColumns = getDefaultColumns({});
const initialEditorState = {
  ...defaultColumns,
  targets: [emptyTarget],
};

const useLocalContext = (props) => {
  const ctx = React.useRef(props);
  ctx.current = props;
  return ctx;
};

export function RulesInput({ onChange, targets, targetValues, targetValuesLoaded, value }) {

  const [ast, setAST] = useState(defaultRule);
  const [columns, setColumns] = useState(initialEditorState);
  const [isEditorReady, setEditorReady] = useState(false);
  const [uipredicateKey, setUipredicateKey] = useState('default');

  useEffect(() => {
    if (value) {
      setAST(value);
    }
  }, [value]);

  useEffect(() => {
    if (targets?.length && targetValuesLoaded) {
      const defaultColumns = getDefaultColumns(targetValues);
      const columns = { ...defaultColumns, targets };
      setColumns(columns);
      const newAST = validateAST([ast], targets);
      if (newAST.predicates.length) {
        setAST(newAST);
      } else {
        setAST(defaultRule);
      }
      setUipredicateKey(uuidv4());
      setEditorReady(true);
    }
  }, [targets, targetValues, targetValuesLoaded]);

  const ctx = useLocalContext({ ast });

  const handleChange = (value) => {
    // value is stripped of keys
    // console.log('!!value:', value);
    const ast = ctx.current.ast;
    // console.log('!!ast:', ast);
    const annotated = deepDiffMapper.map(value, ast);
    // console.log('!!annotated:', annotated);
    const newAST = updateKeys([annotated]);
    // console.log('!!newAST:', newAST);
    setAST(newAST);
    onChange(newAST);
  };

  // console.log('columns:', columns);
  // console.log('ast:', ast);

  if (isEditorReady) {
    return (
      <UIPredicate
        key={uipredicateKey}
        data={ast}
        columns={columns}
        onChange={handleChange}
        ui={{
          [UITypes.TARGETS]: MyTargets,
          [UITypes.LOGICAL_TYPES]: LogicalTypes,
        }}
      />
    );
  } else {
    return (
      <div>Pending</div>
    );
  }
}