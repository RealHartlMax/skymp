import React from 'react';

import '../WidgetForm/legacyControls.scss';
import { ImageButtonProps } from '../../interfaces';
import './ImageButton.scss';

export const ImageButton = ({
  width = 320,
  height = 48,
  disabled,
  onClick,
  src,
  ...other
}: ImageButtonProps) => {
  return (
    <button
      {...other}
      type={other.type || 'button'}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={'login-form--content_social__link'}
      style={{
        opacity: disabled ? 0.6 : 1.0,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <img src={src} alt="" />
    </button>
  );
};
