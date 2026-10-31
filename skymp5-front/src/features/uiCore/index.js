// client/host.tsx
import React, { useEffect, useRef, useState } from "react";

// locales/de.json
var de_default = {
  close: "Schlie\xDFen",
  display: "Darstellung",
  scale: "UI-Skalierung",
  visible: "Sichtbar",
  position: "Position",
  info: "Hinweis",
  success: "Erfolg",
  warning: "Warnung",
  error: "Fehler",
  pending: "Warte auf Server \u2026",
  language: "Sprache / Language",
  "top-left": "Oben links",
  "top-right": "Oben rechts",
  "bottom-left": "Unten links",
  "bottom-right": "Unten rechts"
};

// locales/en.json
var en_default = {
  close: "Close",
  display: "Display",
  scale: "UI scale",
  visible: "Visible",
  position: "Position",
  info: "Info",
  success: "Success",
  warning: "Warning",
  error: "Error",
  pending: "Waiting for server \u2026",
  language: "Language / Sprache",
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right"
};

// shared/localization.ts
var bundledTranslations = { de: de_default, en: en_default };
function translations(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => key !== "de" && key !== "en")) throw new TypeError("Invalid locale catalog");
  const result = { de: { ...de_default }, en: { ...en_default } };
  for (const locale of ["de", "en"]) {
    const custom = input[locale];
    if (custom === void 0) continue;
    if (!custom || typeof custom !== "object" || Array.isArray(custom)) throw new TypeError("Invalid locale: " + locale);
    for (const [key, value] of Object.entries(custom)) {
      if (!Object.prototype.hasOwnProperty.call(de_default, key) || typeof value !== "string" || !value.trim() || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError("Invalid locale key/text: " + locale + "." + key);
      result[locale][key] = value;
    }
  }
  return result;
}

// shared/contracts.ts
var PROTOCOL_VERSION = 1;
var PREFIX = "skympUi:";
var POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"];
var TONES = ["info", "success", "warning", "error"];
var OWNER_RE = /^[a-z][a-z0-9-]{0,47}$/;
var ID_RE = /^[a-z][a-z0-9-]{0,47}:[a-z][a-z0-9._-]{0,46}$/;
var TOKEN_RE = /^[a-zA-Z0-9_-]{1,64}$/;
var ACTION_RE = /^[a-z][a-z0-9._-]{0,47}$/;
function check(value, message) {
  if (!value) throw new TypeError(message);
}
function object(value) {
  check(value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null), "Expected plain object");
}
function keys(value, allowed) {
  check(Object.keys(value).every((key) => allowed.includes(key)), "Unexpected field");
}
function text(value, maximum = 1024) {
  check(typeof value === "string" && value.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), "Invalid text");
}
function finite(value) {
  check(typeof value === "number" && Number.isFinite(value), "Expected finite number");
}
function choice(value, values) {
  check(values.includes(value), "Unsupported value");
}
function owned(owner, id) {
  check(typeof owner === "string" && OWNER_RE.test(owner) && typeof id === "string" && ID_RE.test(id) && id.startsWith(owner + ":"), "Invalid owner/namespace");
}
function serialized(value, maxBytes = 8192) {
  let nodes = 0;
  const visit = (v, depth) => {
    check(++nodes <= 4096 && depth <= 10, "JSON complexity limit");
    if (v === null || typeof v === "boolean") return;
    if (typeof v === "string") {
      text(v, 4096);
      return;
    }
    if (typeof v === "number") {
      finite(v);
      return;
    }
    check(typeof v === "object", "Only JSON data is allowed");
    if (Array.isArray(v)) {
      check(v.length <= 256, "Array limit");
      v.forEach((item) => visit(item, depth + 1));
    } else {
      object(v);
      for (const key of Object.keys(v)) {
        check(key.length <= 96 && !["__proto__", "constructor", "prototype"].includes(key) && !Object.getOwnPropertyDescriptor(v, key)?.get, "Unsafe JSON key");
        visit(v[key], depth + 1);
      }
    }
  };
  visit(value, 0);
  const result = JSON.stringify(value);
  check(new TextEncoder().encode(result).length <= maxBytes, "Payload byte limit");
  return result;
}
function clone(value, maximum = 8192) {
  return JSON.parse(serialized(value, maximum));
}
function widgetDefinition(input) {
  const d = clone(input);
  object(d);
  keys(d, ["id", "owner", "kind", "schemaVersion", "defaultPosition", "defaultVisible", "templateId"]);
  owned(d.owner, d.id);
  check(d.schemaVersion === 1, "Unsupported schemaVersion");
  choice(d.kind, ["status", "progress", "text", "icon-list", "custom-template"]);
  if (d.defaultPosition !== void 0) choice(d.defaultPosition, POSITIONS);
  if (d.defaultVisible !== void 0) check(typeof d.defaultVisible === "boolean", "Invalid visibility");
  if (d.kind === "custom-template") check(d.templateId === "core:status-v1", "Template is not bundled");
  else check(d.templateId === void 0, "templateId only for custom-template");
  return d;
}
function menuDefinition(input) {
  const d = clone(input);
  object(d);
  keys(d, ["id", "owner", "title", "schemaVersion", "layoutId", "modal"]);
  owned(d.owner, d.id);
  text(d.title, 120);
  check(d.title.trim() && d.schemaVersion === 1, "Invalid title/schemaVersion");
  choice(d.layoutId, ["core:dialog-v1", "core:form-v1"]);
  if (d.modal !== void 0) check(typeof d.modal === "boolean", "Invalid modal");
  return d;
}
function widgetState(d, value, maxBytes = 8192) {
  const s = clone(value, maxBytes);
  object(s);
  check(s.schemaVersion === d.schemaVersion, "State schema mismatch");
  if (d.kind === "progress") {
    keys(s, ["schemaVersion", "label", "value", "max"]);
    text(s.label, 160);
    finite(s.value);
    finite(s.max);
    check(s.max > 0 && s.value >= 0 && s.value <= s.max, "Invalid progress range");
  } else if (d.kind === "icon-list") {
    keys(s, ["schemaVersion", "items"]);
    check(Array.isArray(s.items) && s.items.length <= 16, "Invalid items");
    for (const item of s.items) {
      object(item);
      keys(item, ["label", "value", "tone"]);
      text(item.label, 160);
      scalar(item.value);
      if (item.tone !== void 0) choice(item.tone, TONES);
    }
  } else {
    keys(s, ["schemaVersion", "label", "text", "value", "tone"]);
    if (s.label !== void 0) text(s.label, 160);
    if (s.text !== void 0) text(s.text);
    scalar(s.value);
    if (s.tone !== void 0) choice(s.tone, TONES);
    check(s.label !== void 0 || s.text !== void 0 || s.value !== void 0, "Empty widget");
  }
  return s;
}
function scalar(v) {
  if (v !== void 0) {
    if (typeof v === "number") finite(v);
    else text(v, 160);
  }
}
function menuState(d, value, maxBytes = 8192) {
  const s = clone(value, maxBytes);
  object(s);
  keys(s, ["schemaVersion", "text", "fields", "actions"]);
  check(s.schemaVersion === d.schemaVersion, "State schema mismatch");
  if (s.text !== void 0) text(s.text, 2048);
  check(Array.isArray(s.actions) && s.actions.length > 0 && s.actions.length <= 8, "Invalid menu actions");
  const actionIds = /* @__PURE__ */ new Set();
  for (const action of s.actions) {
    object(action);
    keys(action, ["id", "label", "tone"]);
    text(action.label, 80);
    check(typeof action.id === "string" && ACTION_RE.test(action.id) && action.id !== "core.close" && !actionIds.has(action.id), "Invalid/duplicate action");
    actionIds.add(action.id);
    if (action.tone !== void 0) choice(action.tone, TONES);
  }
  if (s.fields !== void 0) {
    check(d.layoutId === "core:form-v1" && Array.isArray(s.fields) && s.fields.length <= 12, "Invalid form fields");
    const ids = /* @__PURE__ */ new Set();
    for (const f of s.fields) {
      object(f);
      keys(f, ["id", "label", "type", "required", "maxLength", "min", "max", "options", "value"]);
      check(typeof f.id === "string" && ACTION_RE.test(f.id) && !["__proto__", "constructor", "prototype"].includes(f.id) && !ids.has(f.id), "Invalid/duplicate field");
      ids.add(f.id);
      text(f.label, 120);
      choice(f.type, ["text", "number", "checkbox", "select"]);
      if (f.required !== void 0) check(typeof f.required === "boolean", "Invalid required");
      if (f.maxLength !== void 0) check(f.type === "text" && Number.isInteger(f.maxLength) && f.maxLength >= 1 && f.maxLength <= 512, "Invalid maxLength");
      if (f.min !== void 0) {
        check(f.type === "number", "min requires number");
        finite(f.min);
      }
      if (f.max !== void 0) {
        check(f.type === "number", "max requires number");
        finite(f.max);
      }
      if (f.min !== void 0 && f.max !== void 0) check(f.min <= f.max, "Invalid range");
      if (f.type === "select") {
        check(Array.isArray(f.options) && f.options.length > 0 && f.options.length <= 24, "Invalid select options");
        const values = /* @__PURE__ */ new Set();
        for (const option of f.options) {
          object(option);
          keys(option, ["value", "label"]);
          text(option.value, 80);
          text(option.label, 120);
          check(!values.has(option.value), "Duplicate option");
          values.add(option.value);
        }
      } else check(f.options === void 0, "Unexpected options");
      if (f.value !== void 0) fieldValue(f, f.value);
    }
  }
  return s;
}
function fieldValue(field, value) {
  if (field.type === "text") {
    text(value, field.maxLength ?? 256);
    if (field.required) check(value.trim().length > 0, "Required text");
  }
  if (field.type === "number") {
    finite(value);
    check((field.min === void 0 || value >= field.min) && (field.max === void 0 || value <= field.max), "Number outside range");
  }
  if (field.type === "checkbox") {
    check(typeof value === "boolean" && (!field.required || value), "Invalid checkbox");
  }
  if (field.type === "select") check(field.options?.some((o) => o.value === value), "Invalid selection");
}
function validateFrame(value) {
  const p = clone(value, 65536);
  object(p);
  keys(p, ["customPacketType", "protocolVersion", "apiVersion", "frontId", "sessionId", "sequence", "serverTime", "preferenceKey", "locale", "translations", "widgets", "menus", "notifications"]);
  choice(p.customPacketType, [PREFIX + "snapshot", PREFIX + "update"]);
  check(p.protocolVersion === 1 && p.apiVersion === 1, "Protocol/API mismatch");
  choice(p.locale, ["de", "en"]);
  object(p.translations);
  p.translations = translations(p.translations);
  check(typeof p.frontId === "string" && TOKEN_RE.test(p.frontId) && typeof p.sessionId === "string" && TOKEN_RE.test(p.sessionId), "Invalid session");
  check(Number.isSafeInteger(p.sequence) && p.sequence > 0 && Number.isSafeInteger(p.serverTime), "Invalid sequence/time");
  check(typeof p.preferenceKey === "string" && /^[a-f0-9]{32}$/.test(p.preferenceKey), "Invalid preference key");
  check(Array.isArray(p.widgets) && p.widgets.length <= 40 && Array.isArray(p.menus) && p.menus.length <= 4 && Array.isArray(p.notifications) && p.notifications.length <= 8, "Frame item limit");
  const ids = /* @__PURE__ */ new Set();
  for (const w of p.widgets) {
    object(w);
    keys(w, ["definition", "state", "visible", "expiresAt"]);
    w.definition = widgetDefinition(w.definition);
    w.state = widgetState(w.definition, w.state);
    check(!ids.has(w.definition.id) && typeof w.visible === "boolean" && Number.isSafeInteger(w.expiresAt), "Invalid widget view");
    ids.add(w.definition.id);
  }
  for (const m of p.menus) {
    object(m);
    keys(m, ["definition", "state", "expiresAt"]);
    m.definition = menuDefinition(m.definition);
    m.state = menuState(m.definition, m.state);
    check(!ids.has(m.definition.id) && Number.isSafeInteger(m.expiresAt), "Invalid menu view");
    ids.add(m.definition.id);
  }
  const notices = /* @__PURE__ */ new Set();
  for (const n of p.notifications) {
    object(n);
    keys(n, ["id", "message", "tone", "expiresAt"]);
    text(n.id, 96);
    text(n.message, 1024);
    choice(n.tone, TONES);
    check(Number.isSafeInteger(n.expiresAt) && !notices.has(n.id), "Invalid notification");
    notices.add(n.id);
  }
  return p;
}

// client/model.ts
var emptyPreferences = () => ({ scale: 100, widgets: {} });
function readPreferences(storage, key) {
  try {
    const raw = storage?.getItem("skymp-ui.v1." + key);
    if (!raw || raw.length > 8192) return emptyPreferences();
    const p = JSON.parse(raw);
    object(p);
    object(p.widgets);
    const result = emptyPreferences();
    if (typeof p.scale === "number" && p.scale >= 75 && p.scale <= 150) result.scale = p.scale;
    for (const [id, v] of Object.entries(p.widgets).slice(0, 40)) {
      object(v);
      if (!/^[a-z][a-z0-9-]{0,47}:[a-z][a-z0-9._-]{0,46}$/.test(id)) continue;
      result.widgets[id] = { ...POSITIONS.includes(v.position) ? { position: v.position } : {}, ...typeof v.hidden === "boolean" ? { hidden: v.hidden } : {} };
    }
    return result;
  } catch {
    return emptyPreferences();
  }
}
var UiModel = class {
  constructor(send2, clock = Date.now) {
    this.send = send2;
    this.clock = clock;
    this.frame = null;
    this.status = "disconnected";
    this.allowed = true;
    this.focused = false;
    this.frontId = this.newId();
    this.counter = 0;
    this.offset = 0;
    this.pending = /* @__PURE__ */ new Map();
  }
  newId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  }
  announce() {
    this.send(PREFIX + "frontReady", { protocolVersion: PROTOCOL_VERSION, frontId: this.frontId });
  }
  reset(status = "disconnected", rotate = false) {
    this.frame = null;
    this.status = status;
    this.pending.clear();
    this.counter = 0;
    this.focused = false;
    if (rotate) this.frontId = this.newId();
  }
  receive(value) {
    try {
      object(value);
      if (value.customPacketType === PREFIX + "reset") {
        this.reset(value.status === "connecting" ? "connecting" : "disconnected", true);
        this.announce();
        return true;
      }
      if (value.customPacketType === PREFIX + "interaction") {
        if (typeof value.allowed !== "boolean") return false;
        this.allowed = value.allowed;
        return true;
      }
      if (value.customPacketType === PREFIX + "status") {
        this.reset(typeof value.status === "string" ? value.status : "unavailable");
        return true;
      }
      if (value.customPacketType === PREFIX + "ack") {
        if (!this.frame || value.sessionId !== this.frame.sessionId || value.frontId !== this.frontId || !TOKEN_RE.test(this.frontId)) return false;
        const p = this.pending.get(value.requestId);
        if (p && (!p.close || value.accepted !== true)) this.pending.delete(value.requestId);
        return true;
      }
      const next = validateFrame(value);
      if (next.frontId !== this.frontId) return false;
      if (!this.frame && next.customPacketType !== PREFIX + "snapshot") return false;
      if (this.frame && (this.frame.sessionId !== next.sessionId || next.sequence <= this.frame.sequence)) return false;
      this.frame = next;
      this.status = "ready";
      this.offset = next.serverTime - this.clock();
      for (const [id, pending] of this.pending) if (!next.menus.some((m) => m.definition.id === pending.id) || this.clock() - pending.at >= 5e3) this.pending.delete(id);
      return true;
    } catch {
      this.reset("invalid-packet");
      return false;
    }
  }
  serverNow() {
    return this.clock() + this.offset;
  }
  visibleMenus() {
    return this.allowed && this.frame ? this.frame.menus.filter((m) => m.expiresAt > this.serverNow() && ![...this.pending.values()].some((p) => p.close && p.id === m.definition.id)) : [];
  }
  action(id, actionId, payload, close = false) {
    if (!this.frame || !this.allowed || this.counter >= 4294967295 || this.pending.size >= 16 || [...this.pending.values()].some((p) => p.id === id)) return false;
    const requestId = this.frame.sessionId + "_" + ++this.counter;
    this.pending.set(requestId, { id, close, at: this.clock() });
    this.send(PREFIX + "action", { protocolVersion: PROTOCOL_VERSION, widgetId: id, actionId, requestId, payload });
    return true;
  }
  dismiss() {
    const m = this.visibleMenus().slice(-1)[0];
    if (m) return this.action(m.definition.id, "core.close", {}, true);
    return false;
  }
  tick() {
    for (const [id, p] of this.pending) if (this.clock() - p.at >= 5e3) this.pending.delete(id);
  }
};

// client/host.tsx
var send = (type, data) => {
  try {
    window.skyrimPlatform?.sendMessage?.(type, data);
  } catch {
  }
};
function Widget({ widget }) {
  const s = widget.state;
  if (widget.definition.kind === "progress") return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", null, s.label), /* @__PURE__ */ React.createElement("progress", { value: s.value, max: s.max, "aria-label": s.label }), /* @__PURE__ */ React.createElement("span", null, s.value, " / ", s.max));
  if (widget.definition.kind === "icon-list") return /* @__PURE__ */ React.createElement("ul", null, s.items.map((item, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "tone-" + (item.tone ?? "info") }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, "\u25C6 "), item.label, " ", item.value)));
  return /* @__PURE__ */ React.createElement("div", { className: "tone-" + (s.tone ?? "info") }, s.label && /* @__PURE__ */ React.createElement("strong", null, s.label), s.value !== void 0 && /* @__PURE__ */ React.createElement("span", { className: "ui-value" }, s.value), s.text && /* @__PURE__ */ React.createElement("p", null, s.text));
}
function Menu({ view, model, changed, t }) {
  const ref = useRef(null);
  const [values, setValues] = useState(() => Object.fromEntries((view.state.fields ?? []).map((f) => [f.id, f.value ?? (f.type === "checkbox" ? false : f.type === "number" ? f.min ?? 0 : f.type === "select" ? f.options[0].value : "")])));
  const waiting = [...model.pending.values()].some((p) => p.id === view.definition.id);
  useEffect(() => {
    ref.current?.querySelector("input, select, button")?.focus();
  }, []);
  function field(f) {
    const shared = { id: `ui-field-${f.id}`, disabled: waiting, required: f.required, "aria-label": f.label };
    if (f.type === "select") return /* @__PURE__ */ React.createElement("select", { ...shared, value: String(values[f.id]), onChange: (e) => setValues({ ...values, [f.id]: e.target.value }) }, f.options.map((o) => /* @__PURE__ */ React.createElement("option", { key: o.value, value: o.value }, o.label)));
    if (f.type === "checkbox") return /* @__PURE__ */ React.createElement("input", { ...shared, type: "checkbox", checked: values[f.id] === true, onChange: (e) => setValues({ ...values, [f.id]: e.target.checked }) });
    return /* @__PURE__ */ React.createElement(
      "input",
      {
        ...shared,
        type: f.type,
        value: values[f.id],
        maxLength: f.maxLength ?? 256,
        min: f.min,
        max: f.max,
        onChange: (e) => setValues({ ...values, [f.id]: f.type === "number" ? e.target.value === "" ? "" : Number(e.target.value) : e.target.value })
      }
    );
  }
  return /* @__PURE__ */ React.createElement("div", { className: view.definition.modal === false ? "ui-menu-panel" : "ui-modal-shade" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "ui-panel ui-menu",
      ref,
      role: "dialog",
      "aria-modal": view.definition.modal !== false,
      "aria-label": view.definition.title,
      onKeyDown: (event) => {
        if (event.key === "Tab") {
          const items = [...ref.current?.querySelectorAll("input:not(:disabled), select:not(:disabled), button:not(:disabled)") ?? []];
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }
    },
    /* @__PURE__ */ React.createElement("h2", null, view.definition.title),
    view.state.text && /* @__PURE__ */ React.createElement("p", null, view.state.text),
    /* @__PURE__ */ React.createElement("form", { onSubmit: (event) => {
      event.preventDefault();
    } }, (view.state.fields ?? []).map((f) => /* @__PURE__ */ React.createElement("label", { className: "ui-field", key: f.id, htmlFor: "ui-field-" + f.id }, f.label, field(f))), /* @__PURE__ */ React.createElement("div", { className: "ui-actions" }, view.state.actions.map((action) => /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        key: action.id,
        disabled: waiting,
        className: "tone-" + (action.tone ?? "info"),
        onClick: (e) => {
          if (e.currentTarget.form?.reportValidity() === false) return;
          model.action(view.definition.id, action.id, { values });
          changed();
        }
      },
      action.label
    )), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => {
      model.dismiss();
      changed();
    } }, t.close))),
    waiting && /* @__PURE__ */ React.createElement("p", { role: "status" }, t.pending)
  ));
}
function Host() {
  const modelRef = useRef();
  if (!modelRef.current) modelRef.current = new UiModel(send);
  const model = modelRef.current;
  const [, render] = useState(0);
  const changed = () => render((n) => n + 1);
  const [preferences, setPreferences] = useState(emptyPreferences);
  const [settings, setSettings] = useState(false), [language, setLanguage] = useState(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const preferenceKey = model.frame?.preferenceKey;
  const menus = model.visibleMenus(), top = menus[menus.length - 1];
  const wantsFocus = model.status === "ready" && model.allowed && (settings || menus.length > 0);
  const effectiveLanguage = language ?? model.frame?.locale ?? "de";
  const t = model.frame?.translations[effectiveLanguage] ?? bundledTranslations[effectiveLanguage];
  useEffect(() => {
    setLanguage(null);
    const receive = (e) => {
      const p = e.detail;
      model.receive(p);
      if (!model.frame) setSettings(false);
      changed();
    };
    const probe = () => model.announce();
    const focused = () => {
      model.focused = true;
      changed();
    };
    const unfocused = () => {
      model.focused = false;
      changed();
    };
    const dismiss = () => {
      if (settingsRef.current) setSettings(false);
      else model.dismiss();
      changed();
    };
    const key = (e) => {
      if (e.key === "Escape" && (model.visibleMenus().length || settingsRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dismiss();
      }
      if (e.key === "Tab" && settingsRef.current) {
        const items = [...document.querySelectorAll('.skymp-ui-core [role="dialog"] input:not(:disabled), .skymp-ui-core [role="dialog"] select:not(:disabled), .skymp-ui-core [role="dialog"] button:not(:disabled)')];
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items[items.length - 1]?.focus();
        } else if (!e.shiftKey && document.activeElement === items[items.length - 1]) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    window.addEventListener("skympUi:packet", receive);
    window.addEventListener("skympUi:probe", probe);
    window.addEventListener("skympUi:dismiss", dismiss);
    window.addEventListener("skymp5-client:browserFocused", focused);
    window.addEventListener("skymp5-client:browserUnfocused", unfocused);
    window.addEventListener("keydown", key, true);
    model.announce();
    const tick = setInterval(() => {
      model.tick();
      changed();
    }, 250);
    return () => {
      clearInterval(tick);
      window.removeEventListener("skympUi:packet", receive);
      window.removeEventListener("skympUi:probe", probe);
      window.removeEventListener("skympUi:dismiss", dismiss);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("skymp5-client:browserFocused", focused);
      window.removeEventListener("skymp5-client:browserUnfocused", unfocused);
      send("skympUi:focus", false);
    };
  }, [model]);
  useEffect(() => {
    send("skympUi:focus", wantsFocus);
  }, [wantsFocus, model.frame?.sessionId]);
  useEffect(() => {
    if (!preferenceKey) {
      setPreferences(emptyPreferences());
      return;
    }
    let storage = null;
    try {
      storage = window.localStorage;
    } catch {
    }
    setPreferences(readPreferences(storage, preferenceKey));
  }, [preferenceKey]);
  function save(next) {
    setPreferences(next);
    try {
      if (preferenceKey) window.localStorage.setItem("skymp-ui.v1." + preferenceKey, JSON.stringify(next));
    } catch {
    }
  }
  if (!model.frame || !model.allowed) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "skymp-ui-core", "data-ui-protocol": "1", style: { "--ui-scale": preferences.scale / 100 } }, POSITIONS.map((position) => /* @__PURE__ */ React.createElement("div", { className: "ui-widgets ui-" + position, key: position }, model.frame.widgets.filter((w) => w.visible && w.expiresAt > model.serverNow() && !preferences.widgets[w.definition.id]?.hidden && (preferences.widgets[w.definition.id]?.position ?? w.definition.defaultPosition ?? "top-right") === position).map((w) => /* @__PURE__ */ React.createElement("section", { className: "ui-panel ui-widget", "data-widget-id": w.definition.id, key: w.definition.id, "aria-label": w.state.label ?? w.definition.id }, /* @__PURE__ */ React.createElement(Widget, { widget: w }))))), /* @__PURE__ */ React.createElement("div", { className: "ui-notifications", role: "log", "aria-live": "polite" }, model.frame.notifications.filter((n) => n.expiresAt > model.serverNow()).slice(-4).map((n) => /* @__PURE__ */ React.createElement("div", { key: n.id, className: "ui-panel ui-notice tone-" + n.tone }, /* @__PURE__ */ React.createElement("strong", null, t[n.tone]), " ", n.message))), !settings && top && /* @__PURE__ */ React.createElement(Menu, { key: top.definition.id + ":" + top.expiresAt, view: top, model, changed, t }), model.focused && !settings && /* @__PURE__ */ React.createElement("button", { className: "ui-display-button", type: "button", onClick: () => setSettings(true) }, t.display), settings && /* @__PURE__ */ React.createElement("div", { className: "ui-modal-shade" }, /* @__PURE__ */ React.createElement("section", { className: "ui-panel ui-menu", role: "dialog", "aria-modal": "true", "aria-label": t.display }, /* @__PURE__ */ React.createElement("h2", null, t.display), /* @__PURE__ */ React.createElement("label", { className: "ui-field" }, t.language, /* @__PURE__ */ React.createElement("select", { "aria-label": t.language, value: effectiveLanguage, onChange: (e) => setLanguage(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "de" }, "Deutsch"), /* @__PURE__ */ React.createElement("option", { value: "en" }, "English"))), /* @__PURE__ */ React.createElement("label", { className: "ui-field" }, t.scale, " ", preferences.scale, "%", /* @__PURE__ */ React.createElement("input", { "aria-label": t.scale, type: "range", min: "75", max: "150", step: "5", value: preferences.scale, onChange: (e) => save({ ...preferences, scale: Number(e.target.value) }) })), model.frame.widgets.map((w) => /* @__PURE__ */ React.createElement("fieldset", { key: w.definition.id }, /* @__PURE__ */ React.createElement("legend", null, w.state.label ?? w.definition.id), /* @__PURE__ */ React.createElement("label", null, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: !preferences.widgets[w.definition.id]?.hidden, onChange: (e) => save({ ...preferences, widgets: { ...preferences.widgets, [w.definition.id]: { ...preferences.widgets[w.definition.id], hidden: !e.target.checked } } }) }), t.visible), /* @__PURE__ */ React.createElement("select", { "aria-label": t.position + " " + w.definition.id, value: preferences.widgets[w.definition.id]?.position ?? w.definition.defaultPosition ?? "top-right", onChange: (e) => save({ ...preferences, widgets: { ...preferences.widgets, [w.definition.id]: { ...preferences.widgets[w.definition.id], position: e.target.value } } }) }, POSITIONS.map((p) => /* @__PURE__ */ React.createElement("option", { key: p, value: p }, t[p]))))), /* @__PURE__ */ React.createElement("button", { type: "button", autoFocus: true, onClick: () => setSettings(false) }, t.close))));
}
var HostBoundary = class extends React.Component {
  constructor() {
    super(...arguments);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    send("skympUi:focus", false);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
};
function UiCoreHost() {
  return /* @__PURE__ */ React.createElement(HostBoundary, null, /* @__PURE__ */ React.createElement(Host, null));
}
export {
  UiCoreHost
};
