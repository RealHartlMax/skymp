import React, { useEffect, useState } from 'react';

import './styles.scss';

const CheckBox = (props: {
  text: string;
  setChecked: (newValue: boolean) => void;
  initialValue: boolean;
  disabled: boolean;
}) => {
  const text = props.text;
  const [value, setValue] = useState(props.initialValue);
  const setChecked = props.setChecked;
  const disabled = props.disabled;
  useEffect(() => setValue(props.initialValue), [props.initialValue]);
  return (
    <label className={'checkbox_container login-form--content_main__container'}>
      <span className={'checkbox_text'}>{text}</span>
      <input
        type="checkbox"
        className="widget-checkbox"
        checked={Boolean(value)}
        disabled={disabled}
        onChange={(event) => {
          const newval = event.target.checked;
          setValue(newval);
          if (setChecked !== undefined) {
            setChecked(newval);
          }
        }}
        style={{ opacity: disabled ? 0.6 : 1.0 }}
      />
    </label>
  );
};

export default CheckBox;
