// Small, dependency-free Markdown helpers for documentation integration only.
const crypto = require('node:crypto');
const path = require('node:path');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const slash = value => value.split(path.sep).join('/');
const navigationStart = '\n<!-- docs-language-navigation -->\n';
const navigationEnd = '<!-- /docs-language-navigation -->\n';
function stripNavigation(text) {
  const start = text.lastIndexOf(navigationStart);
  return start >= 0 && text.slice(start).endsWith(navigationEnd) ? text.slice(0, start) : text;
}
function addNavigation(text, value) {
  return stripNavigation(text) + navigationStart + value + '\n' + navigationEnd;
}
function spans(text) {
  const result = [];
  let marker = null, start = 0, offset = 0;
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) || []) {
    const opening = /^\s*(`{3,}|~{3,})/.exec(line);
    if (!marker && opening) { marker = opening[1]; start = offset; }
    else if (marker && new RegExp('^\\s*' + marker[0] + '{' + marker.length + ',}\\s*$').test(line)) {
      result.push({ start, end: offset + line.length, value: text.slice(start, offset + line.length) }); marker = null;
    }
    offset += line.length;
  }
  if (marker) throw new Error('Unclosed fenced code block');
  return result;
}
function maskCode(text) {
  let masked = text;
  const edits = spans(text);
  for (const span of edits.reverse()) masked = masked.slice(0, span.start) + masked.slice(span.start, span.end).replace(/[^\r\n]/g, ' ') + masked.slice(span.end);
  return masked.replace(/(`+)[^\r\n]*?\1/g, value => value.replace(/[^\r\n]/g, ' '));
}
function links(text) {
  const masked = maskCode(text), result = [];
  const inline = /!?\[((?:\\.|[^\]\\\r\n])*)\]\([ \t]*/g;
  for (const match of masked.matchAll(inline)) {
    let start = match.index + match[0].length, end = start;
    if (masked[start] === '<') {
      start++; end = masked.indexOf('>', start);
      if (end < 0) continue;
    } else {
      let depth = 0;
      for (; end < masked.length; end++) {
        const character = masked[end];
        if (character === '\\') { end++; continue; }
        if (character === '(') depth++;
        if (character === ')') { if (!depth) break; depth--; }
        if (/\s/.test(character) && !depth) break;
      }
    }
    if (end > start) result.push({ start, end, href: text.slice(start, end), label: match[1], kind: 'inline' });
  }
  const reference = /^[ \t]{0,3}\[([^\]\r\n]+)\]:[ \t]*(?:<([^>\r\n]+)>|([^\s]+))/gm;
  for (const match of masked.matchAll(reference)) {
    const href = match[2] ?? match[3], start = match.index + match[0].indexOf(href);
    result.push({ start, end: start + href.length, href: text.slice(start, start + href.length), label: match[1], kind: 'reference' });
  }
  for (const match of masked.matchAll(/\b(?:href|src)=(['"])([^'"\r\n]+)\1/g)) {
    const start = match.index + match[0].indexOf(match[2]);
    result.push({ start, end: start + match[2].length, href: text.slice(start, start + match[2].length), label: '', kind: 'html' });
  }
  return result.sort((a, b) => a.start - b.start);
}
function slug(value) {
  return value.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '').trim().replace(/\s/g, '-');
}
function headings(text) {
  const counts = new Map(), result = [];
  for (const match of maskCode(text).matchAll(/^ {0,3}(#{1,6})[ \t]+([^\r\n]+?)[ \t]*\r?$/gm)) {
    const value = text.slice(match.index, match.index + match[0].length).replace(/\r$/, '').replace(/^ {0,3}#{1,6}[ \t]+/, '').replace(/[ \t]+#+[ \t]*$/, '');
    const id = slug(value), count = counts.get(id) || 0;
    counts.set(id, count + 1);
    result.push({ id: id + (count ? '-' + count : ''), text: value, offset: match.index, level: match[1].length });
  }
  return result;
}
function anchors(text) {
  const result = new Set(headings(text).map(heading => heading.id));
  for (const match of maskCode(text).matchAll(/\b(?:id|name)=(['"])([^'"\r\n]+)\1/g)) result.add(match[2]);
  return result;
}
function parseHref(href) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href) && !/^[a-z]:[\\/]/i.test(href)) return null;
  const split = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(href);
  if (!split) return null;
  let filename, fragment;
  try { filename = decodeURIComponent(split[1].replace(/\\([ ()])/g, '$1')); fragment = decodeURIComponent((split[3] || '').slice(1)); }
  catch { return { error: 'invalid_url_encoding' }; }
  return { filename, query: split[2] || '', hash: split[3] || '', fragment };
}
function relativeHref(from, to, suffix = '') {
  let value = slash(path.relative(path.dirname(from), to)) || path.basename(to);
  value = encodeURI(value).replace(/#/g, '%23').replace(/\?/g, '%3F');
  return value + suffix;
}
function applyEdits(text, edits) {
  const ordered = edits.sort((a, b) => b.start - a.start);
  for (let i = 1; i < ordered.length; i++) if (ordered[i].end > ordered[i - 1].start) throw new Error('Overlapping Markdown edits');
  for (const edit of ordered) text = text.slice(0, edit.start) + edit.value + text.slice(edit.end);
  return text;
}
module.exports = { sha, slash, stripNavigation, addNavigation, spans, maskCode, links, slug, headings, anchors, parseHref, relativeHref, applyEdits };
