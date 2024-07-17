import React from 'react';
import PropTypes from 'prop-types';
import get from 'lodash.get';

import { toNumber } from '../../utils';

export function Input({ type, value, onChange }) {
  const defaultValue = type === 'number' ? 0 : '';
  return (
    <input
      type={type}
      value={value || defaultValue}
      onChange={e => {
        let value;
        if (type === 'number') {
          value = toNumber(e.target.value);
        } else {
          value = e.target.value;
        }
        onChange(value);
      }}
    />
  );
}

Input.propTypes = {
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
};

export function ColorArgument(props) {
  return <Input type="color" {...props} />;
}

export function DateArgument(props) {
  return <Input type="date" {...props} />;
}

export function NumericArgument(props) {
  return <Input type="number" {...props} />;
}

export function TextArgument(props) {
  return <Input type="text" {...props} />;
}

const getCategoryOptions = (values) => {
  const options = values.map(v => ({
    label: v,
    value: v,
  }));
  options.sort((a, b) => a.label < b.label ? -1 : 1);
  return [{ label: 'Select', value: null }, ...options];
};

export function getFeatureArgument(targetValues) {
  return function FeatureArgument({ predicate, value, onChange }) {
    const target = get(predicate, 'target.target_id');
    const values = targetValues[target];
    const options = getCategoryOptions(values || []);
    if (value === null) {
      value = undefined;
    }
    if (options.length) {
      return (
        <select
          onChange={ev => { onChange(ev.target.value); }}
          value={value}
          style={{ maxWidth: 325, minWidth: 175 }}
        >
          {options.map(o =>
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )}
        </select>
      );
    }
    return (
      <input value={value} onChange={onChange} />
    );
  }
}