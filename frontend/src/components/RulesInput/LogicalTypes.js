import React from 'react';
import PropTypes from 'prop-types';

export default function LogicalTypes({ predicate, columns, onChange }) {
  return (
    <>
      <span style={{ marginRight: 4 }}>Match</span>
      <select
        className="ui-predicate__logic"
        value={predicate.logic.logicalType_id}
        onChange={e => onChange(e.target.value)}
      >
        {columns.logicalTypes.map(logicalType => {
          return (
            <option key={logicalType.label} value={logicalType.logicalType_id}>
              {logicalType.label}
            </option>
          );
        })}
      </select>
      <span style={{ marginLeft: 4 }}>of the following conditions:</span>
    </>
  );
}

LogicalTypes.propTypes = {
  predicate: PropTypes.object,
  columns: PropTypes.object,
  onChange: PropTypes.func,
};
