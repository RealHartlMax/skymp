import React from 'react';

import discordSVG from '../../img/discord.svg';
import mailSVG from '../../img/mail.svg';
import passwordSVG from '../../img/password.svg';
import skympSVG from '../../img/skymp.svg';

const Icon = (props) => {
  const text = props.text || '';
  const css = props.css;
  const width = props.width;
  const height = props.height;

  let image = '';

  switch (css) {
    case 'ICON_STYLE_MAIL':
      image = <img src={mailSVG} alt="" />;
      break;
    case 'ICON_STYLE_KEY':
      image = <img src={passwordSVG} alt="" />;
      break;
    case 'ICON_STYLE_SKYMP':
      image = <img src={skympSVG} alt="" />;
      break;
    case 'ICON_STYLE_DISCORD':
      image = <img src={discordSVG} alt="" />;
      break;
    default:
      break;
  }

  return (
    <div className={'login-form--content_main__label'}>
      <span className={'login-form--content_main__label___text'}>{text}</span>
      {image}
    </div>
  );
};

export default Icon;
