import React from 'react';

import WidgetForm from './components/WidgetForm/WidgetForm';
import Chat from './constructorComponents/chat';
import SkillsMenu from './features/skillsMenu';
import TestMenu from './features/testMenu';

const Constructor = (props) => {
  const widget = props.elem;
  switch (widget.type) {
    case 'form':
      return <WidgetForm {...props} />;
    case 'chat':
      return (
        <>
          <SkillsMenu send={widget.send} />
          <Chat
            messages={widget.messages}
            send={widget.send}
            placeholder={widget.placeholder}
            isInputHidden={widget.isInputHidden}
          />
          <TestMenu send={widget.send} />
        </>
      );
    default:
      return null;
  }
};

export default Constructor;
