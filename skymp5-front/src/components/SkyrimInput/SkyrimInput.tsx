import React, { useId } from 'react';

import { SkyrimInputProps } from '../../interfaces';
import './SkyrimInput.scss';

export const SkyrimInput = ({
  width = 320,
  height = 48,
  labelText,
  disabled,
  name,
  type,
  initialValue,
  placeholder,
  onInput,
  id,
  ...other
}: SkyrimInputProps) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div>
      <label
        htmlFor={inputId}
        className={'login-form--content_main__label___text'}
      >
        {labelText}
      </label>
      <div
        className={`skymp-input`}
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <input
          {...other}
          id={inputId}
          disabled={disabled}
          type={type}
          defaultValue={initialValue ?? ''}
          spellCheck={'false'}
          name={name}
          placeholder={placeholder ? placeholder : ''}
          onInput={onInput}
          style={{ opacity: disabled ? 0.6 : 1.0 }}
        />
      </div>
    </div>
  );
};
