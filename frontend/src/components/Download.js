import React from 'react';

export default function Download({ children, filename, payload }) {

  const onClick = () => {
    const url = window.URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)])
    );
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { onClick });
    }
  });

  return childrenWithProps;

}