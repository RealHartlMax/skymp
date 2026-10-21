import React from 'react';

import './styles.scss';

const Text = (props) => {
  const text = props.text || '';
  return (
    <div
      className={'skyrimText'}
      role={props.isStatus ? 'status' : undefined}
      aria-atomic={props.isStatus ? true : undefined}
    >
      <span>{text}</span>
    </div>
  );
};

export default Text;
