import type React from 'react';

/** Roving keyboard focus for automatic-activation, horizontal tab lists. */
export const handleTabNavigation = (event: React.KeyboardEvent<HTMLElement>) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    .filter(tab => !tab.disabled && tab.getClientRects().length > 0);
  const index = tabs.indexOf(event.target as HTMLButtonElement);
  if (index < 0 || !tabs.length) return;
  event.preventDefault();
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? tabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
};
