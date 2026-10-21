const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const artifactDir = path.resolve(__dirname, '../.cache/accessibility');

async function checkAccessibility(page, selector, name, contentSelector) {
  if (!await page.evaluate(() => Boolean(window.axe))) {
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  }
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    if (contentSelector) await page.locator(contentSelector).scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(async (selector) => window.axe.run(
      { include: [[selector]] },
      { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } },
    ), selector);
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, `${name}-${width}.json`), JSON.stringify({
      width,
      violations: result.violations,
      incomplete: result.incomplete,
    }, null, 2));
    await page.screenshot({ path: path.join(artifactDir, `${name}-${width}.png`) });
    assert.deepEqual(result.violations.map(({ id, nodes }) => ({
      id, targets: nodes.map(node => node.target),
    })), [], `${name} at ${width}px must pass axe WCAG A/AA checks`);
    const bounds = await page.locator(selector).boundingBox();
    assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1,
      `${name} must fit horizontally at ${width}px`);
    assert.ok(bounds.y >= -1 && bounds.y + bounds.height <= 801,
      `${name} must fit vertically in the viewport`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${name} must not cause viewport overflow`);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  console.log(`[OK] Accessibility and layout: ${name}, 360px + 1280px`);
}

async function checkFocusWrap(page, selector) {
  // Exercise actual browser Tab behavior at both boundaries of the active dialog.
  const dialog = page.locator(selector);
  const controls = await dialog.evaluateHandle(root => Array.from(
    root.querySelectorAll('button,input,select,textarea,a[href],[tabindex]'),
  ).filter(element => element.tabIndex >= 0 && !element.disabled && element.getClientRects().length &&
    !element.closest('[inert]') && getComputedStyle(element).visibility !== 'hidden'));
  try {
    const length = await controls.evaluate(elements => elements.length);
    assert.ok(length > 0, 'Expected keyboard controls');
    const first = (await controls.getProperty('0')).asElement();
    const last = (await controls.getProperty(String(length - 1))).asElement();
    await last.focus();
    await page.keyboard.press('Tab');
    assert.ok(await first.evaluate(element => document.activeElement === element),
      'Tab at the end must return to the first control');
    await page.keyboard.press('Shift+Tab');
    assert.ok(await last.evaluate(element => document.activeElement === element),
      'Shift+Tab at the start must return to the last control');
  } finally {
    await controls.dispose();
  }
}

module.exports = { checkAccessibility, checkFocusWrap };
