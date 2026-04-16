/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const {
  pingClass,
  pingLabel,
  isValidPort
} = require('../src/features/serverList/utils.ts');
const {
  detectLanguage,
  detectRuntimeLanguage
} = require('../src/utils/i18nLanguage.ts');
const {
  getFrameButtonClassName,
  shouldHandleFrameButtonClick
} = require('../src/components/FrameButton/utils.ts');

const run = (name, fn) => {
  try {
    fn();
    console.log(`[OK] ${name}`);
  } catch (error) {
    console.error(`[FAIL] ${name}`);
    throw error;
  }
};

run('pingClass maps ping buckets', () => {
  assert.equal(pingClass(null), 'server-list__ping--unknown');
  assert.equal(pingClass(20), 'server-list__ping--good');
  assert.equal(pingClass(80), 'server-list__ping--good');
  assert.equal(pingClass(81), 'server-list__ping--ok');
  assert.equal(pingClass(150), 'server-list__ping--ok');
  assert.equal(pingClass(151), 'server-list__ping--bad');
});

run('pingLabel formats values', () => {
  assert.equal(pingLabel(null), '–');
  assert.equal(pingLabel(0), '0ms');
  assert.equal(pingLabel(95), '95ms');
});

run('isValidPort validates integer TCP port range', () => {
  assert.equal(isValidPort(1), true);
  assert.equal(isValidPort(65535), true);
  assert.equal(isValidPort(0), false);
  assert.equal(isValidPort(65536), false);
  assert.equal(isValidPort(7777.5), false);
});

run('detectLanguage resolves supported and fallback locales', () => {
  assert.equal(detectLanguage('en-US'), 'en');
  assert.equal(detectLanguage('ru-RU'), 'ru');
  assert.equal(detectLanguage('de-DE'), 'de');
  assert.equal(detectLanguage('fr-FR'), 'de');
  assert.equal(detectLanguage(undefined), 'de');
});

run('detectRuntimeLanguage falls back when navigator is unavailable', () => {
  assert.equal(detectRuntimeLanguage(), 'de');
});

run('FrameButton helpers map disabled and clickable state', () => {
  assert.equal(getFrameButtonClassName(true), 'skymp-button disabled');
  assert.equal(getFrameButtonClassName(false), 'skymp-button active');
  assert.equal(shouldHandleFrameButtonClick(true), false);
  assert.equal(shouldHandleFrameButtonClick(false), true);
});

console.log('Unit tests passed');
