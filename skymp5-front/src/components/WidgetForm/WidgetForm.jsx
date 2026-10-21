import React, { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '../../constructorComponents/button';
import CheckBox from '../../constructorComponents/checkbox';
import Icon from '../../constructorComponents/icon';
import Text from '../../constructorComponents/text';
import { SkyrimInput } from '../SkyrimInput/SkyrimInput';
import './legacyControls.scss';
import './styles.scss';

/** Renders the existing client widget protocol; OAuth stays in AuthService. */
export default function WidgetForm({ elem, width = 512 }) {
  const { t } = useTranslation();
  const titleId = useId();
  const rootRef = useRef(null);
  useEffect(() => {
    const root = rootRef.current;
    // Widget status refreshes must not steal focus from the current control.
    if (
      root &&
      (document.activeElement === document.body || !document.activeElement)
    ) {
      (
        root.querySelector('button:not(:disabled),input:not(:disabled)') || root
      ).focus();
    }
  }, []);

  const rows = [];
  const elements = elem.elements || [];
  elements.forEach((element, index) => {
    const tags = element.tags || [];
    if (!rows.length || !tags.includes('ELEMENT_SAME_LINE')) rows.push([]);
    rows[rows.length - 1].push({ element, index });
  });
  const renderControl = ({ element, index }) => {
    const tags = element.tags || [];
    const css = tags.find((tag) => /^(BUTTON|ICON)_STYLE_/.test(tag));
    const previous = elements[index - 1];
    const label =
      element.text ||
      (previous?.type === 'icon' ? previous.text : '') ||
      element.placeholder ||
      t('widgetForm.inputLabel', { index: index + 1 });
    switch (element.type) {
      case 'button':
        return (
          <Button
            {...element}
            css={css}
            disabled={element.isDisabled}
            onClick={element.click}
          />
        );
      case 'text':
        return <Text text={element.text} isStatus={element.isStatus} />;
      case 'inputText':
      case 'inputPass':
        return (
          <SkyrimInput
            disabled={element.isDisabled}
            initialValue={element.initialValue}
            labelText={label}
            placeholder={element.placeholder}
            type={element.type === 'inputPass' ? 'password' : 'text'}
            name={String(index)}
            width={element.width}
            height={element.height}
            autoComplete={
              element.type === 'inputPass' ? 'current-password' : 'off'
            }
            onInput={element.onInput}
          />
        );
      case 'checkBox':
        return (
          <CheckBox
            disabled={element.isDisabled}
            initialValue={element.initialValue}
            text={label}
            setChecked={element.setChecked}
          />
        );
      case 'icon':
        return <Icon {...element} css={css} text={
          /^input(Text|Pass)$/.test(elements[index + 1]?.type || '')
            ? '' : element.text
        } />;
      default:
        return null;
    }
  };

  return (
    <section className="login widget-form" aria-labelledby={titleId}>
      <div
        className="widget-form__card"
        style={{ width }}
        ref={rootRef}
        tabIndex={-1}
      >
        <h1 id={titleId} className="widget-form__title">
          {elem.caption || t('widgetForm.title')}
        </h1>
        <div
          className="widget-form__body"
          tabIndex={0}
          role="region"
          aria-label={t('widgetForm.content')}
        >
          {rows.map((row, rowIndex) => (
            <div className="widget-form__row" key={rowIndex}>
              {row.map((item) => (
                <div
                  className="widget-form__control"
                  key={`${item.index}-${item.element.type}`}
                >
                  {renderControl(item)}
                  {item.element.hint && (
                    <p className="widget-form__hint">{item.element.hint}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
