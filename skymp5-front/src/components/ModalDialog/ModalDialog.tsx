import React, { useEffect, useLayoutEffect, useRef } from 'react';

const useModalEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement>;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}

interface OpenDialog {
  element: HTMLDivElement;
  focus: () => void;
  lastFocused?: HTMLElement;
}

const dialogs: OpenDialog[] = [];
const background = new Map<HTMLElement, { inert: boolean; hidden: string | null }>();

const topDialog = () => {
  let top = dialogs[dialogs.length - 1];
  // React mounts child effects before parent effects. Prefer the nested dialog
  // even when both mount in the same render.
  let nested = top && dialogs.find(dialog => dialog !== top && top.element.contains(dialog.element));
  while (nested) {
    top = nested;
    nested = dialogs.find(dialog => dialog !== top && top.element.contains(dialog.element));
  }
  return top;
};

const updateBackground = () => {
  background.forEach((previous, element) => {
    element.toggleAttribute('inert', previous.inert);
    if (previous.hidden === null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', previous.hidden);
  });
  background.clear();
  let current: HTMLElement | null = topDialog()?.element || null;
  while (current?.parentElement) {
    const parent = current.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === current || !(sibling instanceof HTMLElement)) continue;
      background.set(sibling, {
        inert: sibling.hasAttribute('inert'),
        hidden: sibling.getAttribute('aria-hidden')
      });
      sibling.setAttribute('inert', '');
      sibling.setAttribute('aria-hidden', 'true');
    }
    if (parent === document.body) break;
    current = parent;
  }
};

const focusableElements = (root: HTMLElement) => Array.from(
  root.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex],[contenteditable="true"]')
).filter(element => element.tabIndex >= 0 && !element.matches(':disabled') &&
  !element.closest('[inert]') && element.getClientRects().length > 0 &&
  getComputedStyle(element).visibility !== 'hidden');

/** Modal focus/escape handling shared by launcher, dashboard and child dialogs. */
export const ModalDialog: React.FC<Props> = ({ onClose, onEscapeKeyDown, initialFocusRef, children, ...props }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  // Capture before commit: a child's autoFocus runs before this effect.
  const openerRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  );
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onEscapeKeyDownRef = useRef(onEscapeKeyDown);
  onEscapeKeyDownRef.current = onEscapeKeyDown;

  useModalEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const opener = openerRef.current;
    const entry: OpenDialog = {
      element: root,
      focus: () => {
        const preferred = initialFocusRef?.current || entry.lastFocused;
        const target = preferred?.isConnected && root.contains(preferred) &&
          !preferred.matches(':disabled') && preferred.getClientRects().length && !preferred.closest('[inert]')
          ? preferred
          : focusableElements(root)[0] || root;
        target.focus({ preventScroll: true });
      }
    };
    dialogs.push(entry);
    updateBackground();
    if (topDialog() === entry && !root.contains(document.activeElement)) entry.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (topDialog() !== entry) return;
      if (event.key === 'Escape') {
        onEscapeKeyDownRef.current?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        const controls = focusableElements(root);
        const index = controls.indexOf(document.activeElement as HTMLElement);
        if (!controls.length || index < 0 || (!event.shiftKey && index === controls.length - 1) || (event.shiftKey && index === 0)) {
          event.preventDefault();
          (event.shiftKey ? controls[controls.length - 1] || root : controls[0] || root).focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (topDialog() !== entry) return;
      if (!root.contains(event.target as Node)) entry.focus();
      else if (event.target instanceof HTMLElement &&
        event.target.closest('[role="dialog"][aria-modal="true"]') === root) {
        entry.lastFocused = event.target;
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      const wasTop = topDialog() === entry;
      dialogs.splice(dialogs.indexOf(entry), 1);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocus);
      updateBackground();
      if (wasTop) {
        const next = topDialog();
        if (opener?.isConnected && !opener.closest('[inert]') && (!next || next.element.contains(opener))) {
          opener.focus({ preventScroll: true });
        } else next?.focus();
      }
    };
  }, [initialFocusRef]);

  return <div {...props} ref={rootRef} role="dialog" aria-modal="true" tabIndex={-1}>{children}</div>;
};
