import React from 'react';
import PropTypes from 'prop-types';

export default function Target({ columns, predicate, onChange }) {
  const columnGroups = columns.targets.reduce((a, c) => {
    if (!a[c.attr_type]) {
      a[c.attr_type] = [];
    }
    a[c.attr_type].push(c);
    return a;
  }, {});
  return (
    <>
      <select
        className="ui-predicate__targets"
        value={predicate.target.target_id}
        onChange={e => onChange(e.target.value)}
      >
        {Object.entries(columnGroups).map(([g, cols]) =>
          g === 'null' ?
            cols.map(target => {
              return (
                <option key={target.label} value={target.target_id}>
                  {target.label}
                </option>
              );
            })
            :
            <optgroup key={g} label={g}>
              {cols.map(target => {
                return (
                  <option key={target.label} value={target.target_id}>
                    {target.label}
                  </option>
                );
              })}
            </optgroup>
        )}
      </select>
      {predicate.target.type_id === 'event' &&
        <span style={{ marginLeft: 4 }}>occurred</span>
      }
    </>
  );
}

Target.propTypes = {
  columns: PropTypes.object,
  predicate: PropTypes.object,
  onChange: PropTypes.func,
};
