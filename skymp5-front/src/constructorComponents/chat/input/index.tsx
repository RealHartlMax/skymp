import React from 'react';
import './styles.scss';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  fontSize: number;
  maxLength: number;
  label: string;
  disabled?: boolean;
}
const ChatInput = React.forwardRef<HTMLInputElement, ChatInputProps>(function ChatInput(props, ref) {
  return (
    <div className="chat-input--wrapper">
      <input id="chatInput" className="chat-input--text show" type="text" autoComplete="off"
        aria-label={props.label} placeholder={props.placeholder} value={props.value}
        maxLength={props.maxLength} disabled={props.disabled} ref={ref}
        style={{ fontSize: props.fontSize }}
        onChange={event => props.onChange(event.target.value)} onKeyDown={props.onKeyDown} />
    </div>
  );
});
export default ChatInput;
