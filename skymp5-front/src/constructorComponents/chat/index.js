import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import ChatCorner from '../../img/chat_corner.svg';
import ChatInput from './input';
import { sendChat, closeChat } from '../../features/chat/bridge';
import './styles.scss';

const MAX_HISTORY_LENGTH = 20;
const ChatBody = (props) => {
  const chat = useSelector(state => state.chatReducer);
  const dispatch = useDispatch();
  const { t: fallbackT, i18n } = useTranslation();
  // Server-selected chat strings do not change the language of other game UI.
  const t = key => {
    const name = key.startsWith('chat.') ? key.slice(5) : null;
    return name && typeof chat.ui?.[name] === 'string' ? chat.ui[name] : fallbackT(key);
  };
  const inputRef = useRef(null), chatRef = useRef(null), frameRef = useRef(null);
  const atBottom = useRef(true), history = useRef([]), historyIndex = useRef(-1), draft = useRef('');
  const [fontSize, setFontSize] = useState(16), [opacity, setOpacity] = useState(0.72);
  const [settingsOpen, setSettingsOpen] = useState(false), [moveChat, setMoveChat] = useState(false);
  const isInputHidden = props.isInputHidden === true || (chat.showInput !== 'true' && !chat.inputOpen);
  const input = chat.input || '';
  const list = Array.isArray(chat.list) ? chat.list : [];
  const legacySend = typeof props.send === 'function' ? props.send : null;
  const available = chat.status === 'ready' || legacySend !== null;
  const hudHidden = isInputHidden && (chat.status === 'ready' ? !chat.hudVisible : !legacySend);
  const changeInput = value => dispatch({ type: 'UPDATE_CHAT_INPUT', data: value });

  useEffect(() => {
    history.current = []; historyIndex.current = -1; draft.current = '';
  }, [chat.epoch]);

  useEffect(() => {
    if (!isInputHidden || !chat.hudVisible || chat.hideAt === null) return;
    const deadline = chat.hideAt;
    const timer = setTimeout(() => dispatch({ type: 'SKYMP_CHAT_HIDE', data: deadline }), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [chat.hideAt, chat.hudVisible, isInputHidden, dispatch]);

  // Existing chat widgets feed the same Redux list, rather than another store.
  useEffect(() => {
    if (chat.status !== 'ready' && Array.isArray(props.messages)) dispatch({ type: 'UPDATE_CHAT_LIST', data: props.messages });
  }, [props.messages, chat.status, dispatch]);
  useEffect(() => {
    if (!isInputHidden) inputRef.current?.focus();
    else inputRef.current?.blur();
  }, [isInputHidden]);
  useLayoutEffect(() => {
    if (atBottom.current && chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat.list]);
  useEffect(() => {
    if (!chat.pending) return;
    const timer = setTimeout(() => dispatch({ type: 'SKYMP_CHAT_ERROR', data: 'timeout' }), 5000);
    return () => clearTimeout(timer);
  }, [chat.pending, dispatch]);
  useEffect(() => {
    if (isInputHidden) return;
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeChat(); }
    };
    window.addEventListener('keydown', keydown, true);
    return () => window.removeEventListener('keydown', keydown, true);
  }, [isInputHidden]);

  function remember(text) {
    if (history.current[0] !== text) history.current = [text, ...history.current].slice(0, MAX_HISTORY_LENGTH);
    historyIndex.current = -1; draft.current = '';
  }
  function submit() {
    if (!input.trim() || chat.pending) return;
    if (input.length > chat.maxMessageLength) return dispatch({ type: 'SKYMP_CHAT_ERROR', data: 'tooLong' });
    if (!available) return dispatch({ type: 'SKYMP_CHAT_ERROR', data: 'missingBridge' });
    const requestId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    dispatch({ type: 'SKYMP_CHAT_PENDING', data: { requestId, text: input } });
    try {
      if (chat.status !== 'ready' && legacySend) {
        // Preserve the supplied widget contract, with no fabricated network echo.
        legacySend(input);
        dispatch({ type: 'SKYMP_CHAT_ACK', data: { requestId, accepted: true } });
      } else if (!sendChat(input, requestId)) {
        dispatch({ type: 'SKYMP_CHAT_ERROR', data: 'missingBridge' });
        return;
      }
      remember(input);
    } catch { dispatch({ type: 'SKYMP_CHAT_ERROR', data: 'missingBridge' }); }
  }
  function keydown(event) {
    event.stopPropagation();
    if (event.key === 'Enter' && chat.suppressEnter) { event.preventDefault(); return; }
    if (event.nativeEvent.isComposing || event.repeat) return;
    if (event.key === 'Enter') { event.preventDefault(); submit(); }
    if (event.ctrlKey && event.key === 'ArrowUp') {
      event.preventDefault();
      if (historyIndex.current === -1) draft.current = input;
      if (historyIndex.current + 1 < history.current.length) changeInput(history.current[++historyIndex.current]);
    }
    if (event.ctrlKey && event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex.current >= 0) changeInput(--historyIndex.current === -1 ? draft.current : history.current[historyIndex.current]);
    }
  }
  function time(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    try { return date.toLocaleTimeString(chat.locale || i18n.language, { hour: '2-digit', minute: '2-digit' }); }
    catch { return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }); }
  }
  if (!chat.show) return null;
  return (
    <div className="fullPage skymp-chat" style={{ '--chat-opacity': opacity }}>
      <Draggable nodeRef={frameRef} handle=".chat-drag-handle" disabled={!moveChat || isInputHidden} bounds="parent">
        <section id="chat" ref={frameRef} aria-label={t('chat.title')} aria-hidden={hudHidden}
          style={{ visibility: hudHidden ? 'hidden' : undefined }}>
          <div className="chat-main">
            <div className="chat-drag-handle" aria-hidden="true">{t('chat.title')}</div>
            <ResizableBox height={250} minConstraints={[280, 120]} maxConstraints={[800, 600]} axis="y"
              handle={!isInputHidden ? <div className="chat-corner"><img src={ChatCorner} alt="" /></div> : <span />}
              resizeHandles={['nw']} className="list">
              <div className="chat-list" ref={chatRef} role="log" aria-live="polite" style={{ fontSize }}
                onScroll={() => { const el = chatRef.current; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32; }}>
                {list.map((msg, index) => (
                  <div className={`msg chat-${msg.category || 'system'}`} key={msg.id || `legacy-${index}`}>
                    {msg.timestamp && <time dateTime={new Date(msg.timestamp).toISOString()}>[{time(msg.timestamp)}] </time>}
                    {msg.playerName && <strong>{msg.playerName}: </strong>}
                    <span>{typeof msg.text === 'string' ? msg.text : ''}</span>
                  </div>
                ))}
              </div>
            </ResizableBox>
            {!isInputHidden && (
              <div className="input">
                <div className="chat-input">
                  <ChatInput ref={inputRef} value={input} label={t('chat.title')}
                    placeholder={chat.commandsOnly ? t('chat.commandsPlaceholder') : props.placeholder || t('chat.placeholder')} fontSize={fontSize} maxLength={chat.maxMessageLength}
                    onChange={changeInput} onKeyDown={keydown} />
                  <button type="button" onClick={submit} disabled={!available || !!chat.pending}>{t('chat.send')}</button>
                </div>
                <div className="chat-controls">
                  <button type="button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>{t('chat.settings')}</button>
                  <span>{input.length}/{chat.maxMessageLength}</span>
                </div>
                <div className="chat-hint">{t('chat.hint')}</div>
                <div className="chat-status" role="status">{chat.error ? t(`chat.${chat.error}`) : chat.pending ? t('chat.pending') : !available ? t(`chat.${chat.status}`) : ''}</div>
                {settingsOpen && <div className="chat-options">
                  <label>{t('chat.font')} <input aria-label={t('chat.font')} type="range" min="14" max="24" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} /></label>
                  <label>{t('chat.opacity')} <input aria-label={t('chat.opacity')} type="range" min="0.25" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>
                  <label><input type="checkbox" checked={moveChat} onChange={e => setMoveChat(e.target.checked)} /> {t('chat.move')}</label>
                </div>}
              </div>
            )}
          </div>
        </section>
      </Draggable>
    </div>
  );
};
export default function Chat(props) {
  const isManaged = () => window.SkyMPPluginRuntime?.managed === true || window.SkyMPPluginRuntime?.has('skymp-chat') === true;
  const [managed, setManaged] = useState(isManaged);
  useEffect(() => {
    const changed = () => setManaged(isManaged());
    window.addEventListener('skympPluginUi:changed', changed);
    return () => window.removeEventListener('skympPluginUi:changed', changed);
  }, []);
  return managed && props.runtimeModule !== true ? null : <ChatBody {...props} />;
}
