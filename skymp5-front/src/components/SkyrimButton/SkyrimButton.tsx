import React from 'react';

import { SkyrimButtonProps } from '../../interfaces';
import './SkyrimButton.scss';

export const SkyrimButton = ({
  width = 320,
  height = 48,
  disabled,
  onClick,
  text,
  ...other
}: SkyrimButtonProps) => {
  return (
    <button
      {...other}
      type={other.type || 'button'}
      disabled={disabled}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        opacity: disabled ? 0.6 : 1.0,
      }}
      className={'skymp-input-button'}
      onClick={disabled ? undefined : onClick}
    >
      <span
        className={'skymp-input-button_text'}
        style={{ maxHeight: `${height}px` }}
      >
        {text}
      </span>
    </button>
  );
};
