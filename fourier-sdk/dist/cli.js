#!/usr/bin/env bun
// @bun

// src/schema.ts
import {
  SDK_SCHEMA_FIELD_PACKAGE,
  SDK_SCHEMA_VERSION
} from "@fourier-video/core/protocol";

// src/errors.ts
class SdkError extends Error {
  code;
  details;
  constructor(code, message, details) {
    super(message);
    this.name = "SdkError";
    this.code = code;
    if (details !== undefined)
      this.details = details;
  }
}
function sdkFail(code, message, details) {
  throw new SdkError(code, message, details);
}

// src/schema.ts
function makeField(kind, options = {}, extras = {}) {
  const hasDefault = Object.hasOwn(options, "default");
  const { default: defaultValue, ...rest } = options;
  return Object.freeze({
    package: SDK_SCHEMA_FIELD_PACKAGE,
    schemaVersion: SDK_SCHEMA_VERSION,
    kind,
    hasDefault,
    ...hasDefault ? { defaultValue } : {},
    ...rest,
    ...extras
  });
}
function enumField(values, options = {}) {
  if (values.length === 0 || new Set(values).size !== values.length || values.some((value) => value.length === 0)) {
    sdkFail("INVALID_ARTIFACT_SCHEMA", "field.enum values \u5FC5\u987B\u662F\u975E\u7A7A\u4E14\u4E0D\u91CD\u590D\u7684\u5B57\u7B26\u4E32");
  }
  return makeField("enum", options, { values: Object.freeze([...values]) });
}
var field = Object.freeze({
  string: (options = {}) => makeField("string", options),
  number: (options = {}) => makeField("number", options),
  boolean: (options = {}) => makeField("boolean", options),
  color: (options = {}) => makeField("color", options),
  time: (options = {}) => makeField("time", options),
  enum: enumField,
  asset: (options = {}) => makeField("asset", options),
  node: (options = {}) => makeField("node", options)
});
function finiteNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}
function validateField(name, value) {
  if (typeof value !== "object" || value === null || value.package !== SDK_SCHEMA_FIELD_PACKAGE || value.schemaVersion !== SDK_SCHEMA_VERSION) {
    sdkFail("INVALID_ARTIFACT_SCHEMA", `schema.${name} \u5FC5\u987B\u7531 field.*() \u521B\u5EFA`, { field: name });
  }
  const definition = value;
  if (![
    "string",
    "number",
    "boolean",
    "color",
    "time",
    "enum",
    "asset",
    "node"
  ].includes(definition.kind)) {
    sdkFail("INVALID_ARTIFACT_SCHEMA", `schema.${name}.kind \u65E0\u6548`, { field: name });
  }
  if (definition.min !== undefined && !Number.isFinite(definition.min) || definition.max !== undefined && !Number.isFinite(definition.max) || definition.minLength !== undefined && !finiteNonNegativeInteger(definition.minLength) || definition.maxLength !== undefined && !finiteNonNegativeInteger(definition.maxLength)) {
    sdkFail("INVALID_ARTIFACT_SCHEMA", `schema.${name} \u7684\u7EA6\u675F\u65E0\u6548`, { field: name });
  }
  if (definition.min !== undefined && definition.max !== undefined && definition.min > definition.max) {
    sdkFail("INVALID_ARTIFACT_SCHEMA", `schema.${name}.min \u4E0D\u80FD\u5927\u4E8E max`, { field: name });
  }
  if (definition.minLength !== undefined && definition.maxLength !== undefined && definition.minLength > definition.maxLength) {
    sdkFail("INVALID_ARTIFACT_SCHEMA", `schema.${name}.minLength \u4E0D\u80FD\u5927\u4E8E maxLength`, { field: name });
  }
}
function defineSchema(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    sdkFail("INVALID_ARTIFACT_SCHEMA", "schema \u5FC5\u987B\u662F\u5B57\u6BB5\u5BF9\u8C61");
  }
  const entries = Object.entries(input);
  for (const [name, definition] of entries) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      sdkFail("INVALID_ARTIFACT_SCHEMA", `schema \u5B57\u6BB5\u540D\u975E\u6CD5: ${name}`, { field: name });
    }
    validateField(name, definition);
  }
  return Object.freeze({ ...input });
}
function parseTime(source, fps, name) {
  const pattern = /(\d+(?:\.\d+)?)(ms|s|f)/g;
  let cursor = 0;
  let frames = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (match.index !== cursor) {
      sdkFail("INVALID_ARTIFACT_PROP", `${name} \u4E0D\u662F\u6709\u6548\u65F6\u95F4: ${source}`, { field: name });
    }
    cursor = pattern.lastIndex;
    const amount = Number(match[1]);
    const unit = match[2];
    frames += unit === "f" ? amount : unit === "s" ? amount * fps : amount * fps / 1000;
  }
  if (cursor !== source.length || cursor === 0) {
    sdkFail("INVALID_ARTIFACT_PROP", `${name} \u4E0D\u662F\u6709\u6548\u65F6\u95F4: ${source}`, { field: name });
  }
  const rounded = Math.round(frames);
  return Object.freeze({ source, frames: rounded, seconds: rounded / fps });
}
function validateBoundValue(name, definition, input, fps) {
  if (definition.kind === "node") {
    if (input === undefined) {
      sdkFail("MISSING_ARTIFACT_PROP", `\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5 ${name}`, { field: name });
    }
    return input;
  }
  if (definition.kind === "number") {
    if (typeof input !== "number" || !Number.isFinite(input)) {
      sdkFail("INVALID_ARTIFACT_PROP", `${name} \u5FC5\u987B\u662F\u6709\u9650 number`, { field: name, value: input });
    }
    if (definition.integer && !Number.isInteger(input)) {
      sdkFail("INVALID_ARTIFACT_PROP", `${name} \u5FC5\u987B\u662F\u6574\u6570`, { field: name, value: input });
    }
    if (definition.min !== undefined && input < definition.min || definition.max !== undefined && input > definition.max) {
      sdkFail("INVALID_ARTIFACT_PROP", `${name} \u8D85\u51FA schema \u8303\u56F4`, { field: name, value: input });
    }
    return input;
  }
  if (definition.kind === "boolean") {
    if (typeof input !== "boolean") {
      sdkFail("INVALID_ARTIFACT_PROP", `${name} \u5FC5\u987B\u662F boolean`, { field: name, value: input });
    }
    return input;
  }
  if (definition.kind === "time") {
    if (typeof input === "string")
      return parseTime(input, fps, name);
    if (typeof input === "object" && input !== null && typeof input.source === "string" && Number.isInteger(input.frames) && typeof input.seconds === "number") {
      return Object.freeze({ ...input });
    }
    sdkFail("INVALID_ARTIFACT_PROP", `${name} \u5FC5\u987B\u662F\u65F6\u95F4\u5B57\u7B26\u4E32\u6216 TimeValue`, { field: name });
  }
  if (typeof input !== "string") {
    sdkFail("INVALID_ARTIFACT_PROP", `${name} \u5FC5\u987B\u662F string`, { field: name, value: input });
  }
  if (definition.kind === "enum" && !definition.values?.includes(input)) {
    sdkFail("INVALID_ARTIFACT_PROP", `${name} \u5FC5\u987B\u662F schema \u679A\u4E3E\u503C`, { field: name, value: input });
  }
  if (definition.kind === "color" && !(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(input) || /^[a-zA-Z]+$/.test(input))) {
    sdkFail("INVALID_ARTIFACT_PROP", `${name} \u4E0D\u662F\u53D7\u652F\u6301\u7684\u989C\u8272`, { field: name, value: input });
  }
  if (definition.minLength !== undefined && input.length < definition.minLength || definition.maxLength !== undefined && input.length > definition.maxLength) {
    sdkFail("INVALID_ARTIFACT_PROP", `${name} \u957F\u5EA6\u8D85\u51FA schema \u8303\u56F4`, { field: name, value: input });
  }
  return input;
}
function bindSchemaProps(schema, input, options) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    sdkFail("INVALID_ARTIFACT_PROP", "props \u5FC5\u987B\u662F\u5BF9\u8C61");
  }
  const unknown = Object.keys(input).filter((name) => !Object.hasOwn(schema, name));
  if (unknown.length > 0) {
    sdkFail("UNKNOWN_ARTIFACT_PROP", `\u5B58\u5728 schema \u672A\u58F0\u660E\u5B57\u6BB5: ${unknown.join(", ")}`, { fields: unknown });
  }
  const result = {};
  for (const [name, definition] of Object.entries(schema)) {
    const hasValue = Object.hasOwn(input, name);
    if (!hasValue && !definition.hasDefault) {
      sdkFail("MISSING_ARTIFACT_PROP", `\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5 ${name}`, { field: name });
    }
    const value = hasValue ? input[name] : definition.defaultValue;
    result[name] = validateBoundValue(name, definition, value, options.fps);
  }
  return Object.freeze(result);
}

// src/preview.ts
import { watch } from "fs";
import { readdir, stat } from "fs/promises";
import { randomUUID } from "crypto";
import { basename, dirname, relative, resolve, sep } from "path";

// src/artifact-host.ts
import { createArtifactHost } from "@fourier-video/core";
var sdkArtifactHost = createArtifactHost({
  resolveAuthorImport: (specifier) => Bun.resolveSync(specifier, import.meta.dir)
});

// src/player.ts
var PLAYER_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#090909" />
  <title>Fourier Studio</title>
  <link rel="stylesheet" href="/preview-app.css?v=__FOURIER_PREVIEW_ASSET_VERSION__" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/preview-app.js?v=__FOURIER_PREVIEW_ASSET_VERSION__"></script>
</body>
</html>`;
var PLAYER_CSS = String.raw`
:root {
  color: #f5f2eb;
  background: #090909;
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: geometricPrecision;
  --ink: #f5f2eb;
  --muted: #999a94;
  --line: rgba(255, 255, 255, 0.11);
  --panel: #121212;
  --acid: #dfff58;
  color-scheme: dark;
}

* { box-sizing: border-box; }

html { min-width: 320px; min-height: 100%; background: #090909; }

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 82% 4%, rgba(177, 103, 255, 0.16), transparent 26rem),
    radial-gradient(circle at 8% 28%, rgba(223, 255, 88, 0.08), transparent 24rem),
    #090909;
}

body.preview-embed { min-width: 0; min-height: 0; overflow: hidden; background: #101010; }

button, input { font: inherit; }
button, a { -webkit-tap-highlight-color: transparent; }
a { color: inherit; text-decoration: none; }

button:focus-visible, a:focus-visible, input:focus-visible {
  outline: 2px solid var(--acid);
  outline-offset: 3px;
}

.shell { width: min(1480px, 100%); margin: 0 auto; padding: 0 36px 72px; }

.topbar {
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
}

.brand { display: inline-flex; align-items: center; gap: 13px; font-size: 14px; font-weight: 720; letter-spacing: .04em; }
.brand-mark { position: relative; width: 31px; height: 31px; border: 1px solid rgba(255,255,255,.72); border-radius: 50%; }
.brand-mark::before, .brand-mark::after { content: ""; position: absolute; border-radius: 50%; }
.brand-mark::before { inset: 6px; border: 1px solid var(--acid); }
.brand-mark::after { width: 5px; height: 5px; right: -2px; top: 6px; background: var(--acid); box-shadow: 0 0 16px rgba(223,255,88,.8); }
.topbar-note { color: var(--muted); font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }

.hero { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(260px, .55fr); gap: 64px; align-items: end; padding: 76px 0 52px; }
.eyebrow { display: flex; align-items: center; gap: 12px; margin: 0 0 20px; color: var(--acid); font-size: 12px; font-weight: 760; letter-spacing: .16em; text-transform: uppercase; }
.eyebrow::before { content: ""; width: 32px; height: 1px; background: currentColor; }
.hero h1 { max-width: 880px; margin: 0; font-size: clamp(48px, 7.2vw, 112px); font-weight: 580; line-height: .89; letter-spacing: -.068em; }
.hero h1 em { color: var(--acid); font-family: Georgia, "Times New Roman", serif; font-weight: 400; }
.hero-copy { max-width: 360px; margin: 0 0 7px auto; color: #b7b6af; font-size: 16px; line-height: 1.7; }

.library-toolbar { display: flex; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 22px; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; }
.filter-button {
  appearance: none;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 9px 14px;
  color: #a7a7a1;
  background: rgba(255,255,255,.025);
  cursor: pointer;
  font-size: 12px;
  transition: color .2s ease, border-color .2s ease, background .2s ease;
}
.filter-button:hover { color: var(--ink); border-color: rgba(255,255,255,.28); }
.filter-button.active { color: #090909; background: var(--acid); border-color: var(--acid); }
.search-wrap { position: relative; width: min(320px, 42vw); }
.search-wrap::before { content: "\u2315"; position: absolute; left: 14px; top: 8px; color: #787973; font-size: 20px; line-height: 1; }
.search {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 10px 16px 10px 40px;
  color: var(--ink);
  background: rgba(255,255,255,.035);
  outline: none;
}
.search::placeholder { color: #6d6e69; }
.search:focus { border-color: rgba(223,255,88,.6); }

.component-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
.component-card {
  --card-accent: #9f7aea;
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255,255,255,.065), rgba(255,255,255,.018));
  box-shadow: 0 24px 70px rgba(0,0,0,.28);
  animation: card-in .55s cubic-bezier(.2,.8,.2,1) both;
  animation-delay: calc(var(--index, 0) * 55ms);
  transition: transform .35s cubic-bezier(.2,.8,.2,1), border-color .35s ease, box-shadow .35s ease;
}
.component-card.motion { --card-accent: #c09aff; }
.component-card.react { --card-accent: #78d9ff; }
.component-card:hover { transform: translateY(-5px); border-color: rgba(255,255,255,.25); box-shadow: 0 30px 90px rgba(0,0,0,.42); }
.component-card::after { content: ""; position: absolute; inset: auto 12% -45% 12%; height: 58%; background: var(--card-accent); filter: blur(90px); opacity: .09; pointer-events: none; }
.card-preview { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-bottom: 1px solid var(--line); background: #101010; }
.card-preview iframe { width: 100%; height: 100%; display: block; border: 0; pointer-events: none; }
.card-preview-idle { width: 100%; height: 100%; background: linear-gradient(135deg, #151515, #101010); }
.card-preview-idle::after { content: ""; position: absolute; width: 24px; height: 24px; left: 50%; top: 50%; border: 2px solid rgba(255,255,255,.1); border-top-color: rgba(223,255,88,.72); border-radius: 50%; animation: spin 1s linear infinite; transform: translate(-50%, -50%); }
.card-no-preview { height: 100%; display: grid; place-items: center; padding: 28px; color: #ffadad; background: repeating-linear-gradient(-45deg, #131313, #131313 12px, #171717 12px, #171717 24px); text-align: center; font-size: 13px; }
.card-body { position: relative; z-index: 2; display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: end; padding: 22px 24px 24px; }
.card-kicker { margin-bottom: 9px; color: var(--card-accent); font-size: 10px; font-weight: 760; letter-spacing: .15em; text-transform: uppercase; }
.card-title { margin: 0 0 7px; font-size: clamp(21px, 2vw, 30px); font-weight: 610; letter-spacing: -.035em; }
.card-path { max-width: 42ch; margin: 0; overflow: hidden; color: #858681; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.card-open { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.18); border-radius: 50%; color: var(--ink); background: rgba(0,0,0,.12); font-size: 19px; transition: color .2s ease, background .2s ease, transform .2s ease; }
.component-card:hover .card-open { color: #0a0a0a; background: var(--acid); transform: rotate(5deg); }
.card-link { position: absolute; z-index: 4; inset: 0; border-radius: inherit; }

.empty-state, .loading-state { min-height: 360px; display: grid; place-items: center; border: 1px dashed var(--line); border-radius: 24px; color: var(--muted); text-align: center; }
.loading-state span { width: 28px; height: 28px; border: 2px solid rgba(255,255,255,.15); border-top-color: var(--acid); border-radius: 50%; animation: spin .8s linear infinite; }

.detail-shell { width: min(1560px, 100%); margin: 0 auto; padding: 0 36px 52px; }
.detail-topbar { height: 82px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
.back-link { display: inline-flex; align-items: center; gap: 10px; color: #b7b7b1; font-size: 13px; transition: color .2s ease; }
.back-link:hover { color: var(--ink); }
.key-hint { padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; color: #777872; font-size: 10px; }
.detail-heading { display: flex; align-items: end; justify-content: space-between; gap: 32px; padding: 54px 0 28px; }
.detail-heading h1 { margin: 0; font-size: clamp(42px, 6vw, 88px); font-weight: 570; line-height: .95; letter-spacing: -.06em; }
.detail-type { margin-bottom: 7px; color: var(--acid); font-size: 11px; font-weight: 760; letter-spacing: .16em; text-transform: uppercase; }
.detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 22px; align-items: start; }
.detail-player-card { min-width: 0; overflow: hidden; border: 1px solid var(--line); border-radius: 24px; background: #101010; box-shadow: 0 32px 100px rgba(0,0,0,.4); }
.detail-aside { display: grid; gap: 1px; overflow: hidden; border: 1px solid var(--line); border-radius: 18px; background: var(--line); }
.fact { min-width: 0; padding: 18px; background: #111; }
.fact-label { margin-bottom: 7px; color: #6f706b; font-size: 9px; font-weight: 760; letter-spacing: .14em; text-transform: uppercase; }
.fact-value { overflow-wrap: anywhere; color: #d7d5ce; font-size: 13px; line-height: 1.5; }
.fact-value.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }

.preview-player { min-width: 0; background: #101010; }
.preview-player.compact { width: 100vw; height: 100vh; }
.preview-stage {
  position: relative;
  width: 100%;
  height: min(68vh, 780px);
  min-height: 420px;
  overflow: hidden;
  background: #151515;
}
.compact .preview-stage { height: 100vh; min-height: 0; }
.preview-stage.checkerboard {
  background-color: #151515;
  background-image:
    linear-gradient(45deg, #202020 25%, transparent 25%),
    linear-gradient(-45deg, #202020 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #202020 75%),
    linear-gradient(-45deg, transparent 75%, #202020 75%);
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
  background-size: 24px 24px;
}
.preview-viewport { position: absolute; inset: 0; overflow: hidden; }
.preview-mount { position: absolute; display: block; overflow: hidden; transform-origin: center; will-change: transform; }
.preview-mount > #fourier-root { display: block; overflow: hidden; }
.preview-loading, .preview-error { position: absolute; z-index: 3; inset: 0; display: grid; place-items: center; padding: 24px; color: #999a94; background: #121212; text-align: center; font-size: 13px; }
.preview-error { color: #ffb2b2; }
.preview-loading::before { content: ""; width: 24px; height: 24px; border: 2px solid rgba(255,255,255,.15); border-top-color: var(--acid); border-radius: 50%; animation: spin .8s linear infinite; }
.compact-badge { position: absolute; z-index: 4; left: 14px; bottom: 12px; display: flex; align-items: center; gap: 7px; padding: 6px 9px; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; color: rgba(255,255,255,.7); background: rgba(0,0,0,.46); backdrop-filter: blur(14px); font-size: 9px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; opacity: 0; transition: opacity .25s ease; }
.compact:hover .compact-badge { opacity: 1; }
.live-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--acid); box-shadow: 0 0 8px var(--acid); }
.player-controls { display: grid; grid-template-columns: auto auto auto minmax(120px, 1fr) auto auto; gap: 12px; align-items: center; padding: 16px 18px; border-top: 1px solid var(--line); }
.control-button { height: 36px; min-width: 36px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 10px; color: #d7d7d1; background: rgba(255,255,255,.035); cursor: pointer; transition: background .2s ease, border-color .2s ease; }
.control-button:hover:not(:disabled) { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.24); }
.control-button:disabled { opacity: .32; cursor: not-allowed; }
.control-button.primary { width: 42px; color: #090909; background: var(--acid); border-color: var(--acid); font-weight: 850; }
.timeline { width: 100%; height: 3px; accent-color: var(--acid); cursor: pointer; }
.timeline:disabled { opacity: .3; cursor: not-allowed; }
.position { min-width: 104px; color: #989993; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; text-align: right; }
.loop-control { display: inline-flex; align-items: center; gap: 7px; color: #8d8e88; font-size: 11px; white-space: nowrap; }
.loop-control input { accent-color: var(--acid); }
.player-status { min-height: 43px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 19px; border-top: 1px solid rgba(255,255,255,.06); color: #6f706a; font-size: 10px; }
.player-status .error { color: #ffaaaa; }
.snapshot { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes card-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 980px) {
  .hero { grid-template-columns: 1fr; gap: 28px; padding-top: 56px; }
  .hero-copy { margin-left: 0; }
  .component-grid { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
  .detail-aside { grid-template-columns: repeat(2, 1fr); }
  .preview-stage { height: min(62vh, 680px); }
}

@media (max-width: 640px) {
  .shell, .detail-shell { padding-left: 16px; padding-right: 16px; }
  .topbar, .detail-topbar { height: 70px; }
  .topbar-note { display: none; }
  .hero { padding: 46px 0 38px; }
  .hero h1 { font-size: clamp(46px, 15vw, 70px); }
  .library-toolbar { align-items: stretch; flex-direction: column; }
  .search-wrap { width: 100%; }
  .component-grid { gap: 14px; }
  .component-card { border-radius: 18px; }
  .card-body { padding: 18px; }
  .detail-heading { align-items: start; flex-direction: column; padding-top: 38px; }
  .detail-heading h1 { font-size: 46px; }
  .detail-aside { grid-template-columns: 1fr; }
  .preview-stage { height: 54vh; min-height: 300px; }
  .player-controls { grid-template-columns: auto auto auto 1fr; gap: 8px; }
  .player-controls .position { grid-column: 1 / 4; grid-row: 2; text-align: left; }
  .player-controls .loop-control { grid-column: 4; grid-row: 2; justify-self: end; }
  .player-status { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto !important; }
  .component-card, .preview-loading::before, .card-preview-idle::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
`;

// src/types.ts
import {
  SDK_ABI_VERSION,
  SDK_ARTIFACT,
  SDK_ARTIFACT_SYMBOL_KEY
} from "@fourier-video/core/protocol";
var DESIGN_PREVIEW_FPS = 60;
var MAX_DESIGN_PREVIEW_SECONDS = 30;

// src/preview-config.ts
function positiveInteger(value, field2) {
  if (!Number.isInteger(value) || value <= 0) {
    sdkFail("INVALID_PREVIEW_CONFIG", `${field2} \u5FC5\u987B\u662F\u6B63\u6574\u6570`, {
      field: field2,
      value
    });
  }
  return value;
}
function resolveDuration(composition) {
  const durationSeconds = composition.durationSeconds;
  if (!Number.isInteger(durationSeconds) || durationSeconds !== 0 && (durationSeconds < 1 || durationSeconds > MAX_DESIGN_PREVIEW_SECONDS)) {
    sdkFail("INVALID_PREVIEW_DURATION", `composition.durationSeconds \u5FC5\u987B\u4E3A\u9759\u6001 0\uFF0C\u6216 1\u2014${MAX_DESIGN_PREVIEW_SECONDS} \u7684\u6574\u6570\u79D2`, { value: durationSeconds });
  }
  const staticPreview = durationSeconds === 0;
  const durationInFrames = staticPreview ? 1 : durationSeconds * DESIGN_PREVIEW_FPS;
  if (composition.fps !== undefined && composition.fps !== DESIGN_PREVIEW_FPS) {
    sdkFail("DESIGN_PREVIEW_FPS_FIXED", `design preview fps \u56FA\u5B9A\u4E3A ${DESIGN_PREVIEW_FPS}\uFF0C\u7EC4\u4EF6\u4E0D\u80FD\u8986\u76D6`, { value: composition.fps });
  }
  if (composition.durationInFrames !== undefined && composition.durationInFrames !== durationInFrames) {
    sdkFail("INVALID_PREVIEW_DURATION", "durationInFrames \u5FC5\u987B\u7531 SDK \u6839\u636E durationSeconds \u6C42\u89E3", { value: composition.durationInFrames, expected: durationInFrames });
  }
  if (composition.static !== undefined && composition.static !== staticPreview) {
    sdkFail("INVALID_PREVIEW_DURATION", "static \u5FC5\u987B\u7531 SDK \u6839\u636E durationSeconds \u6C42\u89E3", { value: composition.static, expected: staticPreview });
  }
  return {
    durationSeconds,
    durationInFrames,
    static: staticPreview
  };
}
function validatePreviewConfig(config) {
  if (typeof config !== "object" || config === null) {
    sdkFail("INVALID_PREVIEW_CONFIG", "preview config \u5FC5\u987B\u662F\u5BF9\u8C61");
  }
  const metadata = config.artifact?.[SDK_ARTIFACT];
  if (metadata === undefined) {
    sdkFail("ARTIFACT_EXPORT_INVALID", "preview config.artifact \u5FC5\u987B\u7531 defineReact\u3001defineMotion \u6216 defineShader \u521B\u5EFA");
  }
  if (typeof config.props !== "object" || config.props === null || Array.isArray(config.props)) {
    sdkFail("INVALID_PREVIEW_CONFIG", "preview config.props \u5FC5\u987B\u662F\u5BF9\u8C61");
  }
  if (typeof config.composition !== "object" || config.composition === null) {
    sdkFail("INVALID_PREVIEW_CONFIG", "composition \u5FC5\u987B\u662F\u5BF9\u8C61");
  }
  const width = positiveInteger(config.composition.width, "composition.width");
  const height = positiveInteger(config.composition.height, "composition.height");
  const duration = resolveDuration(config.composition);
  if (config.seed !== undefined && (!Number.isInteger(config.seed) || config.seed < 0)) {
    sdkFail("INVALID_PREVIEW_CONFIG", "seed \u5FC5\u987B\u662F\u975E\u8D1F\u6574\u6570");
  }
  for (const [index, font] of (config.fonts ?? []).entries()) {
    if (font.family.trim().length === 0 || font.source.trim().length === 0) {
      sdkFail("INVALID_PREVIEW_CONFIG", `fonts[${index}] \u7684 family/source \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    }
  }
  if (metadata.kind === "motion") {
    const motionConfig = config;
    if ((!("renderer" in metadata) || metadata.renderer !== "dom-timeline-ffmpeg-video") && motionConfig.subject === undefined) {
      sdkFail("INVALID_PREVIEW_CONFIG", "Motion preview \u5FC5\u987B\u58F0\u660E subject");
    }
    const startFrame = motionConfig.motion?.startFrame ?? 0;
    const motionDuration = motionConfig.motion?.durationInFrames ?? duration.durationInFrames;
    if (!Number.isInteger(startFrame) || startFrame < 0) {
      sdkFail("INVALID_PREVIEW_CONFIG", "motion.startFrame \u5FC5\u987B\u662F\u975E\u8D1F\u6574\u6570");
    }
    positiveInteger(motionDuration, "motion.durationInFrames");
    if (startFrame + motionDuration > duration.durationInFrames) {
      sdkFail("INVALID_PREVIEW_CONFIG", "Motion \u65F6\u95F4\u8303\u56F4\u4E0D\u80FD\u8D85\u8FC7 design preview \u65F6\u957F");
    }
    const fill = motionConfig.motion?.fill ?? "both";
    if (!["none", "forwards", "backwards", "both"].includes(fill)) {
      sdkFail("INVALID_PREVIEW_CONFIG", `motion.fill \u4E0D\u53D7\u652F\u6301: ${fill}`);
    }
  }
  if (metadata.kind === "shader" && (typeof config.subject !== "string" || config.subject.length === 0)) {
    sdkFail("INVALID_PREVIEW_CONFIG", "Shader preview \u5FC5\u987B\u58F0\u660E\u56FE\u7247 subject");
  }
  const normalized = {
    ...config,
    composition: Object.freeze({
      width,
      height,
      durationSeconds: duration.durationSeconds,
      fps: DESIGN_PREVIEW_FPS,
      durationInFrames: duration.durationInFrames,
      static: duration.static
    }),
    props: bindSchemaProps(metadata.schema, config.props, {
      fps: DESIGN_PREVIEW_FPS
    }),
    ...config.fonts === undefined ? {} : {
      fonts: Object.freeze(config.fonts.map((font) => Object.freeze({ ...font })))
    },
    ...metadata.kind !== "motion" ? {} : {
      motion: Object.freeze({
        startFrame: config.motion?.startFrame ?? 0,
        durationInFrames: config.motion?.durationInFrames ?? duration.durationInFrames,
        fill: config.motion?.fill ?? "both"
      })
    }
  };
  return Object.freeze(normalized);
}
function definePreview(config) {
  return validatePreviewConfig(config);
}
function resolveDesignPreview(artifact) {
  const metadata = artifact?.[SDK_ARTIFACT];
  if (metadata === undefined) {
    sdkFail("ARTIFACT_EXPORT_INVALID", "design preview \u5165\u53E3\u5FC5\u987B\u7531 defineReact\u3001defineMotion \u6216 defineShader \u521B\u5EFA");
  }
  const preview = metadata.designPreview();
  if (typeof preview !== "object" || preview === null) {
    sdkFail("INVALID_DESIGN_PREVIEW", `${metadata.name}.designPreview() \u5FC5\u987B\u8FD4\u56DE\u9884\u89C8\u914D\u7F6E\u5BF9\u8C61`);
  }
  return validatePreviewConfig({
    ...preview,
    artifact
  });
}

// src/preview.ts
var { compileVisualArtifact } = sdkArtifactHost;
var encoder = new TextEncoder;
var previewBuildSerial = Promise.resolve();
var previewAppBundle;
function defaultPreviewSourcePath() {
  return resolve(import.meta.dir, "../example");
}
function diagnostic(error) {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    const source = error;
    return {
      code: source.code,
      message: typeof source.message === "string" ? source.message : String(error),
      ...source.details === undefined ? {} : { details: source.details }
    };
  }
  return {
    code: "PREVIEW_BUILD_FAILED",
    message: error instanceof Error ? error.message : String(error)
  };
}
function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" }
  });
}
function corsResponse(request, response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", request.headers.get("access-control-request-headers") ?? "*");
  headers.set("access-control-max-age", "86400");
  headers.append("vary", "access-control-request-headers");
  if (request.headers.get("access-control-request-private-network") === "true") {
    headers.set("access-control-allow-private-network", "true");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
function domRuntimeCss(artifact) {
  const fonts = artifact.fonts.filter((font) => font.dataUrl !== undefined).map((font) => `@font-face{font-family:${JSON.stringify(font.family)};src:url(${JSON.stringify(font.dataUrl)})}`).join(`
`);
  return `${fonts}
${artifact.bundleSnapshot?.css ?? ""}`;
}
function domRuntimeJavascript(artifact) {
  const bundleSnapshot = artifact.bundleSnapshot;
  if (bundleSnapshot === undefined)
    return "";
  let javascript = bundleSnapshot.javascript;
  for (const asset of bundleSnapshot.imageAssets ?? []) {
    javascript = javascript.replaceAll(asset.url, `data:${asset.mimeType};base64,${asset.base64}`);
  }
  return javascript;
}
async function compileSessionNow(configPath) {
  const artifact = await compileVisualArtifact({
    entryPath: configPath,
    sourceRoot: dirname(configPath),
    resourceRoots: [dirname(configPath)],
    mode: "design-preview"
  });
  const preview = artifact.designPreview;
  const config = Object.freeze({
    composition: Object.freeze({
      ...preview.composition,
      fps: artifact.composition.fps,
      durationInFrames: artifact.composition.durationInFrames,
      static: preview.composition.durationSeconds === 0
    }),
    ...preview.player === undefined ? {} : { player: preview.player }
  });
  const dependencies = artifact.dependencies;
  return { mode: "browser-dom", artifact, config, dependencies };
}
function compileSession(configPath) {
  const next = previewBuildSerial.then(() => compileSessionNow(configPath), () => compileSessionNow(configPath));
  previewBuildSerial = next.then(() => {
    return;
  }, () => {
    return;
  });
  return next;
}
function sessionSnapshotId(session) {
  return session.artifact.snapshotId;
}
function sessionName(session) {
  return session.artifact.name;
}
function sessionKind(session) {
  return session.artifact.kind;
}
async function closeSession(_session) {}
async function collectComponentFiles(directory) {
  const files = [];
  const visit = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist")
        return;
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && /\.(?:tsx|jsx)$/.test(entry.name) && !/\.(?:test|spec)\.(?:tsx|jsx)$/.test(entry.name)) {
        files.push(path);
      }
    }));
  };
  await visit(directory);
  return files.sort((left, right) => left.localeCompare(right, "en"));
}
async function discoverEntries(sourcePath) {
  const information = await stat(sourcePath);
  if (information.isFile()) {
    return [{ id: basename(sourcePath), path: basename(sourcePath), sourcePath }];
  }
  if (!information.isDirectory()) {
    throw new TypeError("preview \u5165\u53E3\u5FC5\u987B\u662F artifact \u6587\u4EF6\u6216\u76EE\u5F55");
  }
  const files = await collectComponentFiles(sourcePath);
  return files.map((path) => {
    const displayPath = relative(sourcePath, path).split(sep).join("/");
    return { id: displayPath, path: displayPath, sourcePath: path };
  });
}
async function buildPreviewApp() {
  const candidates = [
    resolve(import.meta.dir, "preview-app.tsx"),
    resolve(import.meta.dir, "../src/preview-app.tsx")
  ];
  let entryPath;
  for (const candidate of candidates) {
    if (await Bun.file(candidate).exists()) {
      entryPath = candidate;
      break;
    }
  }
  if (entryPath === undefined)
    throw new Error("preview React app source is missing");
  const result = await Bun.build({
    entrypoints: [entryPath],
    target: "browser",
    format: "esm",
    splitting: false,
    minify: true,
    define: { "process.env.NODE_ENV": JSON.stringify("production") }
  });
  if (!result.success || result.outputs.length === 0) {
    throw new Error(result.logs.map((log) => log.message).join(`
`) || "preview React app build failed");
  }
  return result.outputs[0].text();
}
function getPreviewApp() {
  previewAppBundle ??= buildPreviewApp().catch((error) => {
    previewAppBundle = undefined;
    throw error;
  });
  return previewAppBundle;
}
function artifactParameter(id) {
  return `artifact=${encodeURIComponent(id)}`;
}
function recordSummary(record) {
  const current = record.current;
  if (current === undefined) {
    return {
      id: record.entry.id,
      path: record.entry.path,
      status: "error",
      diagnostic: record.diagnostic ?? {
        code: "PREVIEW_NOT_READY",
        message: "\u7EC4\u4EF6\u5C1A\u672A\u7F16\u8BD1\u5B8C\u6210"
      }
    };
  }
  return {
    id: record.entry.id,
    path: record.entry.path,
    status: "ready",
    name: sessionName(current),
    kind: sessionKind(current),
    renderMode: current.mode,
    snapshotId: sessionSnapshotId(current),
    composition: current.config.composition,
    ...record.diagnostic === undefined ? {} : { diagnostic: record.diagnostic }
  };
}
function sessionPayload(record, current) {
  const query = artifactParameter(record.entry.id);
  return {
    status: "ready",
    id: record.entry.id,
    path: record.entry.path,
    renderMode: current.mode,
    snapshotId: sessionSnapshotId(current),
    kind: sessionKind(current),
    name: sessionName(current),
    composition: current.config.composition,
    player: {
      background: current.config.player?.background ?? "checkerboard",
      loop: current.config.player?.loop ?? true
    },
    runtime: {
      scriptUrl: `/api/runtime.js?${query}&snapshot=${encodeURIComponent(current.artifact.snapshotId)}`,
      styleUrl: `/api/runtime.css?${query}&snapshot=${encodeURIComponent(current.artifact.snapshotId)}`,
      seed: current.artifact.seed,
      durationMilliseconds: (current.artifact.modifier ?? current.artifact.motion) !== undefined ? (current.artifact.modifier ?? current.artifact.motion).durationInFrames / DESIGN_PREVIEW_FPS * 1000 : current.config.composition.durationSeconds * 1000,
      durationInFrames: (current.artifact.modifier ?? current.artifact.motion) !== undefined ? (current.artifact.modifier ?? current.artifact.motion).durationInFrames : current.config.composition.durationInFrames,
      ...current.artifact.motion === undefined ? {} : { motion: current.artifact.motion },
      ...current.artifact.textSubject === undefined ? {} : { textSubject: current.artifact.textSubject }
    },
    ...record.diagnostic === undefined ? {} : { diagnostic: record.diagnostic }
  };
}
async function startPreviewServer(options = {}) {
  const sourcePath = resolve(options.entryPath ?? options.configPath ?? defaultPreviewSourcePath());
  const sourceInformation = await stat(sourcePath);
  const watchPath = sourceInformation.isDirectory() ? sourcePath : dirname(sourcePath);
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? 3211;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new TypeError("port \u5FC5\u987B\u662F 0\u201465535 \u7684\u6574\u6570");
  }
  const publicPort = options.publicPort;
  if (publicPort !== undefined && (!Number.isInteger(publicPort) || publicPort < 0 || publicPort > 65535)) {
    throw new TypeError("publicPort \u5FC5\u987B\u662F 0\u201465535 \u7684\u6574\u6570");
  }
  const clients = new Set;
  const assetVersion = randomUUID();
  const playerHtml = PLAYER_HTML.replaceAll("__FOURIER_PREVIEW_ASSET_VERSION__", encodeURIComponent(assetVersion));
  let records = new Map;
  let watcher;
  let debounce;
  const pendingChanges = new Set;
  let reloadAll = false;
  let revision = 0;
  let stopped = false;
  const emit = (event, value) => {
    const bytes = encoder.encode(`event: ${event}
data: ${JSON.stringify(value)}

`);
    for (const client of clients) {
      try {
        client.controller.enqueue(bytes);
      } catch {
        clients.delete(client);
      }
    }
  };
  const reload = async (changedPaths) => {
    const requestedRevision = ++revision;
    let entries;
    try {
      entries = await discoverEntries(sourcePath);
    } catch (error) {
      if (requestedRevision === revision && !stopped) {
        emit("diagnostic", { id: "", ...diagnostic(error) });
      }
      return;
    }
    const entriesToCompile = changedPaths === undefined ? entries : entries.filter((entry) => {
      const previous = records.get(entry.id);
      if (previous?.current === undefined)
        return true;
      return changedPaths.has(entry.sourcePath) || previous.current.dependencies.some((dependency) => changedPaths.has(dependency));
    });
    const compiled = await Promise.all(entriesToCompile.map(async (entry) => {
      try {
        return { entry, session: await compileSession(entry.sourcePath) };
      } catch (error) {
        return { entry, error: diagnostic(error) };
      }
    }));
    if (stopped || requestedRevision !== revision) {
      await Promise.all(compiled.map((result) => ("session" in result) ? closeSession(result.session) : Promise.resolve()));
      return;
    }
    const previousRecords = records;
    const nextRecords = new Map;
    const compiledById = new Map(compiled.map((result) => [result.entry.id, result]));
    for (const entry of entries) {
      const result = compiledById.get(entry.id);
      const previous = previousRecords.get(entry.id);
      if (result === undefined) {
        if (previous !== undefined)
          nextRecords.set(entry.id, { ...previous, entry });
      } else if ("session" in result) {
        nextRecords.set(entry.id, { entry, current: result.session });
      } else {
        nextRecords.set(entry.id, {
          entry,
          ...previous?.current === undefined ? {} : { current: previous.current },
          diagnostic: result.error
        });
      }
    }
    records = nextRecords;
    await Promise.all([...previousRecords.entries()].map(([id, previous]) => {
      const next = nextRecords.get(id);
      if (previous.current === undefined || next?.current === previous.current)
        return Promise.resolve();
      return closeSession(previous.current);
    }));
    for (const result of compiled) {
      if ("session" in result) {
        emit("snapshot", {
          id: result.entry.id,
          snapshotId: sessionSnapshotId(result.session),
          name: sessionName(result.session)
        });
      } else {
        emit("diagnostic", { id: result.entry.id, ...result.error });
      }
    }
    for (const [id] of previousRecords) {
      if (!nextRecords.has(id))
        emit("snapshot", { id, removed: true });
    }
  };
  await reload();
  const findRecord = (url) => {
    const requestedId = url.searchParams.get("artifact");
    if (requestedId !== null)
      return records.get(requestedId);
    return records.values().next().value;
  };
  const handleRequest = async (request) => {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(playerHtml, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }
    if (request.method === "GET" && url.pathname === "/preview-app.css") {
      return new Response(PLAYER_CSS, {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "private, max-age=31536000, immutable"
        }
      });
    }
    if (request.method === "GET" && url.pathname === "/preview-app.js") {
      try {
        return new Response(await getPreviewApp(), {
          headers: {
            "content-type": "text/javascript; charset=utf-8",
            "cache-control": "private, max-age=31536000, immutable"
          }
        });
      } catch (error) {
        return new Response(`throw new Error(${JSON.stringify(diagnostic(error).message)});`, {
          status: 500,
          headers: { "content-type": "text/javascript; charset=utf-8" }
        });
      }
    }
    if (request.method === "GET" && url.pathname === "/api/artifacts") {
      return json({ artifacts: [...records.values()].map(recordSummary) });
    }
    if (request.method === "GET" && url.pathname === "/api/session") {
      const record = findRecord(url);
      if (record?.current === undefined) {
        return json({
          status: "error",
          diagnostic: record?.diagnostic ?? {
            code: records.size === 0 ? "PREVIEW_EMPTY" : "PREVIEW_NOT_FOUND",
            message: records.size === 0 ? "\u76EE\u5F55\u4E2D\u6CA1\u6709\u627E\u5230\u7EC4\u4EF6" : "\u6CA1\u6709\u627E\u5230\u8BE5\u7EC4\u4EF6"
          }
        }, 503);
      }
      return json(sessionPayload(record, record.current));
    }
    if (request.method === "GET" && (url.pathname === "/api/runtime.js" || url.pathname === "/api/runtime.css")) {
      const record = findRecord(url);
      const current = record?.current;
      if (current === undefined || current.artifact.bundleSnapshot === undefined) {
        return json({ error: { code: "DOM_PREVIEW_NOT_READY", message: "DOM preview runtime \u5C1A\u672A\u5C31\u7EEA" } }, 404);
      }
      const requestedSnapshot = url.searchParams.get("snapshot");
      if (requestedSnapshot !== current.artifact.snapshotId) {
        return json({
          error: { code: "STALE_PREVIEW_SNAPSHOT", message: "preview snapshot \u5DF2\u66F4\u65B0" },
          snapshotId: current.artifact.snapshotId
        }, 409);
      }
      const javascript = url.pathname.endsWith(".js");
      return new Response(javascript ? domRuntimeJavascript(current.artifact) : domRuntimeCss(current.artifact), {
        headers: {
          "content-type": javascript ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8",
          "cache-control": "private, max-age=31536000, immutable",
          etag: `"${current.artifact.snapshotId}-${javascript ? "js" : "css"}"`
        }
      });
    }
    if (request.method === "GET" && url.pathname === "/api/events") {
      let client;
      const stream = new ReadableStream({
        start(controller) {
          client = { controller };
          clients.add(client);
          controller.enqueue(encoder.encode(`retry: 500

`));
        },
        cancel() {
          if (client !== undefined)
            clients.delete(client);
        }
      });
      request.signal.addEventListener("abort", () => {
        if (client !== undefined)
          clients.delete(client);
        try {
          client?.controller.close();
        } catch {}
      }, { once: true });
      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-store",
          connection: "keep-alive"
        }
      });
    }
    const frameMatch = /^\/api\/frames\/(\d+)\.png$/.exec(url.pathname);
    if (request.method === "GET" && frameMatch !== null) {
      const record = findRecord(url);
      if (record === undefined || record.current === undefined) {
        return json({ error: record?.diagnostic ?? { code: "PREVIEW_NOT_READY", message: "\u9884\u89C8\u5C1A\u672A\u5C31\u7EEA" } }, 503);
      }
      return json({
        error: {
          code: "DOM_PREVIEW_DIRECT",
          message: "SDK ABI preview \u7531\u6D4F\u89C8\u5668\u76F4\u63A5\u6E32\u67D3\uFF0C\u4E0D\u63D0\u4F9B PNG \u5E27\u63A5\u53E3"
        }
      }, 404);
    }
    return json({ error: { code: "NOT_FOUND", message: "route not found" } }, 404);
  };
  const server = Bun.serve({
    hostname,
    port,
    fetch: handleRequest
  });
  let publicServer;
  try {
    publicServer = publicPort === undefined ? undefined : Bun.serve({
      hostname: "0.0.0.0",
      port: publicPort,
      async fetch(request) {
        if (request.method === "OPTIONS") {
          return corsResponse(request, new Response(null, { status: 204 }));
        }
        return corsResponse(request, await handleRequest(request));
      }
    });
  } catch (error) {
    server.stop(true);
    const active = [...records.values()].map((record) => record.current);
    records.clear();
    await Promise.all(active.map(closeSession));
    throw error;
  }
  if (options.watch ?? true) {
    const queueReload = (changedPath) => {
      if (changedPath === undefined)
        reloadAll = true;
      else
        pendingChanges.add(changedPath);
      if (debounce !== undefined)
        clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = undefined;
        const changes = reloadAll ? undefined : new Set(pendingChanges);
        reloadAll = false;
        pendingChanges.clear();
        reload(changes);
      }, 100);
    };
    try {
      watcher = watch(watchPath, { recursive: true }, (_event, path) => {
        const name = (path === null ? "" : String(path)).split("\\").join("/");
        if (name.includes("node_modules/") || name.includes("/.git/") || name.startsWith("dist/") || name.startsWith(".git/")) {
          return;
        }
        queueReload(name === "" ? undefined : resolve(watchPath, name));
      });
    } catch {
      watcher = watch(sourcePath, () => queueReload(sourcePath));
    }
  }
  const actualPort = server.port ?? port;
  const actualPublicPort = publicServer?.port ?? publicPort;
  return Object.freeze({
    hostname,
    port: actualPort,
    url: `http://${hostname}:${actualPort}`,
    ...actualPublicPort === undefined ? {} : {
      publicPort: actualPublicPort,
      publicUrl: `http://0.0.0.0:${actualPublicPort}`
    },
    reload: () => reload(),
    async stop() {
      if (stopped)
        return;
      stopped = true;
      revision += 1;
      if (debounce !== undefined)
        clearTimeout(debounce);
      pendingChanges.clear();
      watcher?.close();
      for (const client of clients) {
        try {
          client.controller.close();
        } catch {}
      }
      clients.clear();
      const active = [...records.values()].map((record) => record.current);
      records.clear();
      await Promise.all(active.map(closeSession));
      server.stop(true);
      publicServer?.stop(true);
    }
  });
}

// src/world-manifest.ts
import { realpath, stat as stat2 } from "fs/promises";
import { basename as basename2, dirname as dirname2, isAbsolute, relative as relative2, resolve as resolve2 } from "path";
var WORLD_COMPONENT_TYPES = [
  "card",
  "motion",
  "shader",
  "graphic",
  "scene-template",
  "other"
];
var WORLD_STYLES = [
  "minimal",
  "corporate",
  "editorial",
  "cinematic",
  "futuristic",
  "playful",
  "brutalist",
  "elegant",
  "social",
  "hand-drawn"
];
var WORLD_MOODS = [
  "restrained",
  "serious",
  "energetic",
  "warm",
  "playful",
  "tense",
  "futuristic"
];
var WORLD_LANGUAGES = ["en", "zh-CN", "zh-TW", "ja", "ko"];

class WorldManifestError extends TypeError {
  issues;
  constructor(packagePath, issues) {
    super(`\u65E0\u6548\u7684 Fourier World package.json (${packagePath}):
- ${issues.join(`
- `)}`);
    this.name = "WorldManifestError";
    this.issues = Object.freeze([...issues]);
  }
}
function parseWorldPackageName(value) {
  const match = /^(@[a-z][a-z0-9_-]{1,30})\/([A-Za-z][A-Za-z0-9_-]*)$/.exec(value);
  if (match === null) {
    throw new TypeError("\u5305\u540D\u5FC5\u987B\u662F @namespace/ComponentName");
  }
  return Object.freeze({ namespace: match[1], componentName: match[2] });
}
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
function requiredString(source, key, issues, label = key) {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${label} \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    return "";
  }
  return value.trim();
}
function optionalString(source, key, issues, label) {
  const value = source[key];
  if (value === undefined)
    return;
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${label} \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    return;
  }
  return value.trim();
}
function stringArray(value, label, issues, required) {
  if (value === undefined && !required)
    return;
  if (!Array.isArray(value) || required && value.length === 0) {
    issues.push(`${label} \u5FC5\u987B\u662F${required ? "\u975E\u7A7A" : ""}\u5B57\u7B26\u4E32\u6570\u7EC4`);
    return;
  }
  const entries = [];
  for (let index = 0;index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== "string" || item.trim().length === 0) {
      issues.push(`${label}[${index}] \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    } else {
      entries.push(item.trim());
    }
  }
  return entries;
}
function enumValue(value, options, label, issues) {
  if (typeof value !== "string" || !options.includes(value)) {
    issues.push(`${label} \u5FC5\u987B\u662F ${options.join("\u3001")} \u4E4B\u4E00`);
    return options[0];
  }
  return value;
}
function enumArray(value, options, label, issues, required) {
  const entries = stringArray(value, label, issues, required);
  if (entries === undefined)
    return;
  for (const entry of entries) {
    if (!options.includes(entry)) {
      issues.push(`${label} \u5305\u542B\u65E0\u6548\u503C ${JSON.stringify(entry)}\uFF1B\u53EF\u9009\u503C: ${options.join("\u3001")}`);
    }
  }
  return entries.filter((entry) => options.includes(entry));
}
function packageJsonPath(inputPath) {
  const absolute = resolve2(inputPath);
  return basename2(absolute) === "package.json" ? absolute : resolve2(absolute, "package.json");
}
function isInside(parent, child) {
  const path = relative2(parent, child);
  return path.length === 0 || !path.startsWith("..") && !isAbsolute(path);
}
async function loadWorldPackage(inputPath = process.cwd()) {
  const packagePath = packageJsonPath(inputPath);
  let parsed;
  try {
    parsed = JSON.parse(await Bun.file(packagePath).text());
  } catch (error) {
    if (!await Bun.file(packagePath).exists()) {
      throw new WorldManifestError(packagePath, ["publish \u76EE\u5F55\u5FC5\u987B\u5305\u542B package.json"]);
    }
    throw new WorldManifestError(packagePath, [
      `JSON \u89E3\u6790\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`
    ]);
  }
  const issues = [];
  const root = record(parsed);
  if (root === undefined) {
    throw new WorldManifestError(packagePath, ["\u6839\u503C\u5FC5\u987B\u662F JSON \u5BF9\u8C61"]);
  }
  const name = requiredString(root, "name", issues);
  let packageIdentity;
  if (name) {
    try {
      packageIdentity = parseWorldPackageName(name);
    } catch {
      issues.push("name \u5FC5\u987B\u662F @namespace/ComponentName\uFF1Bnamespace \u4F7F\u7528\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u3001_ \u6216 -\uFF0C\u7EC4\u4EF6\u540D\u5FC5\u987B\u4EE5\u82F1\u6587\u5B57\u6BCD\u5F00\u5934");
    }
  }
  const version = requiredString(root, "version", issues);
  if (version && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    issues.push("version \u5FC5\u987B\u662F semver\uFF0C\u4F8B\u5982 1.0.0 \u6216 1.0.0-beta.1");
  }
  const description = requiredString(root, "description", issues);
  const license = requiredString(root, "license", issues);
  if (license && license !== "MIT")
    issues.push("license \u5F53\u524D\u53EA\u652F\u6301 MIT");
  const files = stringArray(root.files, "files", issues, true) ?? [];
  for (const [index, path] of files.entries()) {
    const segments = path.replaceAll("\\", "/").split("/");
    if (isAbsolute(path) || path.includes("\\") || segments.includes("..") || segments.includes("") || /[*?{}\[\]!]/.test(path)) {
      issues.push(`files[${index}] \u5FC5\u987B\u662F package \u76EE\u5F55\u5185\u4E0D\u542B glob \u7684\u76F8\u5BF9\u6587\u4EF6\u6216\u76EE\u5F55\u8DEF\u5F84`);
    }
    if (segments.some((segment) => segment === ".git" || segment === "node_modules")) {
      issues.push(`files[${index}] \u4E0D\u80FD\u5305\u542B .git \u6216 node_modules`);
    }
  }
  const fourier = record(root.fourier);
  if (fourier === undefined)
    issues.push("fourier \u5FC5\u987B\u662F\u5BF9\u8C61");
  const metadata = fourier ?? {};
  const entry = requiredString(metadata, "entry", issues, "fourier.entry");
  if (entry && isAbsolute(entry))
    issues.push("fourier.entry \u5FC5\u987B\u662F\u76F8\u5BF9 package.json \u7684\u8DEF\u5F84");
  const type = enumValue(metadata.type, WORLD_COMPONENT_TYPES, "fourier.type", issues);
  const subtype = optionalString(metadata, "subtype", issues, "fourier.subtype");
  if (subtype !== undefined && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(subtype)) {
    issues.push("fourier.subtype \u53EA\u80FD\u5305\u542B\u82F1\u6587\u5B57\u6BCD\u3001\u6570\u5B57\u3001_ \u548C -\uFF0C\u4E14\u5FC5\u987B\u4EE5\u82F1\u6587\u5B57\u6BCD\u5F00\u5934");
  }
  const summary = requiredString(metadata, "summary", issues, "fourier.summary");
  if (summary.length > 180)
    issues.push("fourier.summary \u4E0D\u80FD\u8D85\u8FC7 180 \u4E2A\u5B57\u7B26");
  const instruction = requiredString(metadata, "instruction", issues, "fourier.instruction");
  const useCases = stringArray(metadata.useCases, "fourier.useCases", issues, true) ?? [];
  const negativeUseCases = stringArray(metadata.negativeUseCases, "fourier.negativeUseCases", issues, false);
  const aliases = stringArray(metadata.aliases, "fourier.aliases", issues, false);
  const tags = stringArray(metadata.tags, "fourier.tags", issues, true) ?? [];
  const style = enumArray(metadata.style, WORLD_STYLES, "fourier.style", issues, true) ?? [];
  if (style.length > 3)
    issues.push("fourier.style \u5FC5\u987B\u5305\u542B 1\u20143 \u9879");
  const contentDomains = stringArray(metadata.contentDomains, "fourier.contentDomains", issues, false);
  const mood = enumArray(metadata.mood, WORLD_MOODS, "fourier.mood", issues, false);
  const languages = enumArray(metadata.languages, WORLD_LANGUAGES, "fourier.languages", issues, false);
  const rootDirectory = dirname2(packagePath);
  const entryPath = resolve2(rootDirectory, entry);
  if (entry && !isInside(rootDirectory, entryPath)) {
    issues.push("fourier.entry \u4E0D\u80FD\u6307\u5411 package.json \u76EE\u5F55\u4E4B\u5916");
  } else if (entry) {
    try {
      const [rootRealPath, entryRealPath, entryStat] = await Promise.all([
        realpath(rootDirectory),
        realpath(entryPath),
        stat2(entryPath)
      ]);
      if (!isInside(rootRealPath, entryRealPath))
        issues.push("fourier.entry \u4E0D\u80FD\u901A\u8FC7\u7B26\u53F7\u94FE\u63A5\u6307\u5411 package.json \u76EE\u5F55\u4E4B\u5916");
      if (!entryStat.isFile())
        issues.push("fourier.entry \u5FC5\u987B\u6307\u5411\u6587\u4EF6");
    } catch {
      issues.push(`fourier.entry \u6587\u4EF6\u4E0D\u5B58\u5728: ${entry}`);
    }
  }
  if (issues.length > 0 || packageIdentity === undefined) {
    throw new WorldManifestError(packagePath, issues);
  }
  const worldManifest = Object.freeze({
    entry,
    type,
    ...subtype === undefined ? {} : { subtype },
    summary,
    instruction,
    useCases: Object.freeze(useCases),
    ...negativeUseCases === undefined ? {} : { negativeUseCases: Object.freeze(negativeUseCases) },
    ...aliases === undefined ? {} : { aliases: Object.freeze(aliases) },
    tags: Object.freeze(tags),
    style: Object.freeze(style),
    ...contentDomains === undefined ? {} : { contentDomains: Object.freeze(contentDomains) },
    ...mood === undefined ? {} : { mood: Object.freeze(mood) },
    ...languages === undefined ? {} : { languages: Object.freeze(languages) }
  });
  const manifest = Object.freeze({
    name,
    version,
    description,
    license: "MIT",
    files: Object.freeze(files),
    fourier: worldManifest
  });
  return Object.freeze({
    packagePath,
    rootDirectory,
    entryPath,
    namespace: packageIdentity.namespace,
    componentName: packageIdentity.componentName,
    manifest
  });
}

// src/npm-package.ts
import { createHash } from "crypto";
import { mkdir, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { dirname as dirname3, isAbsolute as isAbsolute2, join, posix } from "path";
var MAX_NPM_PACKAGE_BYTES = 10 * 1024 * 1024;
var MAX_NPM_UNPACKED_BYTES = 20 * 1024 * 1024;
var MAX_NPM_PACKAGE_FILES = 500;
var MAX_NPM_COMPONENTS = 50;
function record2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
function exactVersion(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}
function parseNpmPackageReference(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("npm \u5F15\u7528\u5FC5\u987B\u662F\u7CBE\u786E\u7248\u672C https://www.npmjs.com/package/@scope/name/v/1.2.3 URL");
  }
  if (url.protocol !== "https:" || url.hostname !== "www.npmjs.com" || url.port || url.username || url.password || url.search) {
    throw new TypeError("npm \u5F15\u7528\u53EA\u63A5\u53D7\u65E0\u8BA4\u8BC1\u3001\u7AEF\u53E3\u548C\u67E5\u8BE2\u53C2\u6570\u7684 https://www.npmjs.com \u7CBE\u786E\u7248\u672C URL");
  }
  const segments = url.pathname.split("/");
  if (segments.length !== 6 || segments[0] !== "" || segments[1] !== "package" || !/^@[a-z0-9][a-z0-9._-]*$/.test(segments[2] ?? "") || !/^[a-z0-9][a-z0-9._-]*$/.test(segments[3] ?? "") || segments[4] !== "v" || !exactVersion(segments[5] ?? "")) {
    throw new TypeError("npm \u5F15\u7528\u5FC5\u987B\u662F\u7CBE\u786E\u7248\u672C https://www.npmjs.com/package/@scope/name/v/1.2.3 URL");
  }
  const componentName = url.hash ? url.hash.slice(1) : undefined;
  if (componentName !== undefined && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(componentName)) {
    throw new TypeError("npm \u7EC4\u4EF6 fragment \u5FC5\u987B\u662F ComponentName");
  }
  const namespace = segments[2];
  const packageName = `${namespace}/${segments[3]}`;
  const version = segments[5];
  const packageUrl = `https://www.npmjs.com/package/${packageName}/v/${version}`;
  return Object.freeze({
    packageUrl,
    ...componentName === undefined ? {} : { componentUrl: `${packageUrl}#${componentName}` },
    packageName,
    namespace,
    version,
    ...componentName === undefined ? {} : { componentName }
  });
}
function safeArchivePath(value) {
  if (!value.startsWith("package/") || value.includes("\\") || isAbsolute2(value))
    return;
  const relative3 = value.slice("package/".length);
  if (!relative3 || posix.normalize(relative3) !== relative3 || relative3.split("/").includes(".."))
    return;
  return relative3;
}
function manifestPaths(value) {
  const root = record2(value);
  const fourier = record2(root?.fourier);
  const components = fourier?.components;
  if (fourier?.schemaVersion !== 1 || !Array.isArray(components)) {
    throw new TypeError("npm package.json \u5FC5\u987B\u5305\u542B fourier.schemaVersion: 1 \u548C fourier.components \u6570\u7EC4");
  }
  if (components.length < 1 || components.length > MAX_NPM_COMPONENTS) {
    throw new TypeError(`fourier.components \u5FC5\u987B\u5305\u542B 1\u2014${MAX_NPM_COMPONENTS} \u4E2A\u7EC4\u4EF6 manifest`);
  }
  const paths = components.map((entry, index) => {
    if (typeof entry !== "string" || !entry.endsWith("/package.json") || entry.includes("\\") || isAbsolute2(entry) || posix.normalize(entry) !== entry || entry.split("/").includes("..")) {
      throw new TypeError(`fourier.components[${index}] \u5FC5\u987B\u662F package \u5185\u7EC4\u4EF6 package.json \u7684\u89C4\u8303\u76F8\u5BF9\u8DEF\u5F84`);
    }
    return entry;
  });
  if (new Set(paths).size !== paths.length)
    throw new TypeError("fourier.components \u4E0D\u80FD\u5305\u542B\u91CD\u590D\u8DEF\u5F84");
  return Object.freeze(paths);
}
async function responseBody(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
async function resolveNpmPackage(input, fetcher = globalThis.fetch) {
  const reference = parseNpmPackageReference(input);
  const metadataUrl = `https://registry.npmjs.org/${encodeURIComponent(reference.packageName)}/${reference.version}`;
  const metadataResponse = await fetcher(metadataUrl, { headers: { accept: "application/json" }, redirect: "error" });
  const metadata = record2(await responseBody(metadataResponse));
  if (!metadataResponse.ok)
    throw new TypeError(`npm registry \u65E0\u6CD5\u89E3\u6790 ${reference.packageName}@${reference.version}`);
  const dist = record2(metadata?.dist);
  if (metadata?.name !== reference.packageName || metadata.version !== reference.version || typeof dist?.tarball !== "string" || typeof dist.integrity !== "string" || !dist.integrity.startsWith("sha512-")) {
    throw new TypeError("npm registry \u7CBE\u786E\u7248\u672C\u5143\u6570\u636E\u683C\u5F0F\u65E0\u6548");
  }
  const tarballUrl = new URL(dist.tarball);
  if (tarballUrl.protocol !== "https:" || tarballUrl.hostname !== "registry.npmjs.org" || tarballUrl.port) {
    throw new TypeError("npm dist.tarball \u5FC5\u987B\u4F4D\u4E8E\u5B98\u65B9 HTTPS registry");
  }
  if (typeof dist.fileCount === "number" && (!Number.isInteger(dist.fileCount) || dist.fileCount < 1 || dist.fileCount > MAX_NPM_PACKAGE_FILES)) {
    throw new TypeError(`npm package \u6587\u4EF6\u6570\u4E0D\u80FD\u8D85\u8FC7 ${MAX_NPM_PACKAGE_FILES}`);
  }
  if (typeof dist.unpackedSize === "number" && (!Number.isInteger(dist.unpackedSize) || dist.unpackedSize < 1 || dist.unpackedSize > MAX_NPM_UNPACKED_BYTES)) {
    throw new TypeError(`npm package \u89E3\u538B\u5C3A\u5BF8\u4E0D\u80FD\u8D85\u8FC7 ${MAX_NPM_UNPACKED_BYTES} bytes`);
  }
  const tarballResponse = await fetcher(tarballUrl, { redirect: "error" });
  if (!tarballResponse.ok)
    throw new TypeError("npm tarball \u4E0B\u8F7D\u5931\u8D25");
  const declaredLength = Number(tarballResponse.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_NPM_PACKAGE_BYTES) {
    throw new TypeError(`npm tarball \u4E0D\u80FD\u8D85\u8FC7 ${MAX_NPM_PACKAGE_BYTES} bytes`);
  }
  const bytes = new Uint8Array(await tarballResponse.arrayBuffer());
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_NPM_PACKAGE_BYTES) {
    throw new TypeError(`npm tarball \u5FC5\u987B\u4E3A 1\u2014${MAX_NPM_PACKAGE_BYTES} bytes`);
  }
  const actualIntegrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  if (actualIntegrity !== dist.integrity)
    throw new TypeError("npm tarball integrity \u4E0E registry \u5143\u6570\u636E\u4E0D\u4E00\u81F4");
  let files;
  try {
    files = await new Bun.Archive(bytes).files();
  } catch {
    throw new TypeError("npm tarball \u65E0\u6CD5\u89E3\u6790");
  }
  if (files.size < 1 || files.size > MAX_NPM_PACKAGE_FILES) {
    throw new TypeError(`npm package \u5FC5\u987B\u5305\u542B 1\u2014${MAX_NPM_PACKAGE_FILES} \u4E2A\u6587\u4EF6`);
  }
  const unpackedSize = [...files.values()].reduce((total, file) => total + file.size, 0);
  if (unpackedSize < 1 || unpackedSize > MAX_NPM_UNPACKED_BYTES) {
    throw new TypeError(`npm package \u89E3\u538B\u5C3A\u5BF8\u4E0D\u80FD\u8D85\u8FC7 ${MAX_NPM_UNPACKED_BYTES} bytes`);
  }
  const rootDirectory = await mkdtemp(join(tmpdir(), "fourier-npm-package-"));
  try {
    for (const [archivePath, file] of files) {
      const path = safeArchivePath(archivePath);
      if (path === undefined)
        throw new TypeError(`npm tarball \u5305\u542B\u65E0\u6548\u8DEF\u5F84: ${archivePath}`);
      const destination = join(rootDirectory, path);
      await mkdir(dirname3(destination), { recursive: true });
      await Bun.write(destination, file);
    }
    const rootPackagePath = join(rootDirectory, "package.json");
    let rootPackage;
    try {
      rootPackage = JSON.parse(await Bun.file(rootPackagePath).text());
    } catch {
      throw new TypeError("npm tarball \u6839\u76EE\u5F55\u7F3A\u5C11\u6709\u6548 package.json");
    }
    const root = record2(rootPackage);
    if (root?.name !== reference.packageName || root.version !== reference.version || root.license !== "MIT") {
      throw new TypeError("npm package.json \u7684 name\u3001version \u6216 MIT license \u4E0E\u5F15\u7528\u4E0D\u4E00\u81F4");
    }
    const components = await Promise.all(manifestPaths(rootPackage).map((path) => loadWorldPackage(join(rootDirectory, path))));
    const names = new Set;
    for (const component of components) {
      if (component.namespace !== reference.namespace || component.manifest.version !== reference.version) {
        throw new TypeError(`\u7EC4\u4EF6 ${component.manifest.name} \u7684 scope \u6216 version \u4E0E npm package \u4E0D\u4E00\u81F4`);
      }
      if (names.has(component.componentName))
        throw new TypeError(`npm package \u5305\u542B\u91CD\u590D\u7EC4\u4EF6 ${component.componentName}`);
      names.add(component.componentName);
    }
    if (reference.componentName !== undefined && !names.has(reference.componentName)) {
      throw new TypeError(`npm package \u4E0D\u5305\u542B\u7EC4\u4EF6 ${reference.componentName}`);
    }
    return Object.freeze({
      reference,
      integrity: dist.integrity,
      tarballUrl: tarballUrl.href,
      fileCount: files.size,
      unpackedSize,
      rootDirectory,
      components: Object.freeze(components),
      cleanup: () => rm(rootDirectory, { recursive: true, force: true })
    });
  } catch (error) {
    await rm(rootDirectory, { recursive: true, force: true });
    throw error;
  }
}

// src/world-preview.ts
import { mkdtemp as mkdtemp2, readFile, rm as rm2 } from "fs/promises";
import { tmpdir as tmpdir2 } from "os";
import { join as join2 } from "path";
var { renderVisualArtifactVideo } = sdkArtifactHost;
var MAX_WORLD_PREVIEW_BYTES = 32 * 1024 * 1024;
var WORLD_PREVIEW_DOM_PAGES = 3;
async function renderWorldPreviewVideo(artifact, options = {}) {
  const directory = await mkdtemp2(join2(tmpdir2(), "fourier-world-preview-"));
  const output = join2(directory, "preview.mp4");
  try {
    const result = await renderVisualArtifactVideo(artifact, {
      output,
      overwrite: true,
      crf: 26,
      preset: "medium",
      domPages: WORLD_PREVIEW_DOM_PAGES,
      ...options.ffmpegPath === undefined ? {} : { ffmpegPath: options.ffmpegPath }
    });
    if (result.byteLength > MAX_WORLD_PREVIEW_BYTES) {
      sdkFail("WORLD_PREVIEW_TOO_LARGE", `\u672C\u5730\u6E32\u67D3\u7684\u9884\u89C8 MP4 \u4E0D\u80FD\u8D85\u8FC7 ${MAX_WORLD_PREVIEW_BYTES} bytes`, { byteLength: result.byteLength, maximum: MAX_WORLD_PREVIEW_BYTES });
    }
    return Object.freeze({
      bytes: new Uint8Array(await readFile(output)),
      mimeType: "video/mp4",
      sha256: result.sha256,
      width: result.width,
      height: result.height,
      fps: result.fps,
      totalFrames: result.totalFrames,
      durationSeconds: result.durationSeconds
    });
  } finally {
    await rm2(directory, { recursive: true, force: true });
  }
}

// src/world-client.ts
var DEFAULT_FOURIER_WORLD_URL = "https://www.fourier.video";

class FourierWorldApiError extends Error {
  status;
  details;
  constructor(status, message, details) {
    super(message);
    this.name = "FourierWorldApiError";
    this.status = status;
    this.details = details;
  }
}
function object(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
function normalizeToken(token) {
  return token.replace(/^(?:JWT|Bearer)\s+/i, "").trim();
}
function normalizeWorldUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`\u65E0\u6548\u7684 Fourier World URL: ${value}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Fourier World URL \u53EA\u652F\u6301 http \u6216 https");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("Fourier World URL \u4E0D\u80FD\u5305\u542B\u8D26\u53F7\u3001\u67E5\u8BE2\u53C2\u6570\u6216 fragment");
  }
  return url.href.replace(/\/$/, "");
}
function errorMessage(status, body) {
  const data = object(body);
  if (typeof data?.message === "string")
    return data.message;
  const nestedError = object(data?.error);
  if (typeof nestedError?.message === "string")
    return nestedError.message;
  if (Array.isArray(data?.errors)) {
    const messages = data.errors.map((entry) => object(entry)?.message).filter((entry) => typeof entry === "string");
    if (messages.length > 0)
      return messages.join("\uFF1B");
  }
  if (status === 401)
    return "\u767B\u5F55\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u8FD0\u884C fourier-sdk login";
  if (status === 403)
    return "\u5F53\u524D Fourier World \u8D26\u53F7\u6CA1\u6709\u53D1\u5E03\u6743\u9650";
  return `Fourier World \u8BF7\u6C42\u5931\u8D25 (HTTP ${status})`;
}
async function responseBody2(response) {
  const text = await response.text();
  if (text.length === 0)
    return;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function loginResult(value) {
  const data = object(value);
  const user = object(data?.user);
  if (typeof data?.token !== "string" || typeof user?.id !== "string" && typeof user?.id !== "number" || typeof user.email !== "string" || typeof user.name !== "string" || user.role !== "admin" && user.role !== "reviewer" && user.role !== "user") {
    throw new FourierWorldApiError(502, "Fourier World \u767B\u5F55\u54CD\u5E94\u683C\u5F0F\u65E0\u6548", value);
  }
  return Object.freeze({
    token: normalizeToken(data.token),
    ...typeof data.exp === "number" ? { exp: data.exp } : {},
    user: Object.freeze({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    })
  });
}
function componentRecord(value) {
  const wrapper = object(value);
  const data = object(wrapper?.doc) ?? wrapper;
  if (data === undefined || typeof data.id !== "string" && typeof data.id !== "number" || typeof data.namespace !== "string" || typeof data.name !== "string" || typeof data.version !== "string" || !["draft", "review", "published", "unlisted"].includes(String(data.status))) {
    throw new FourierWorldApiError(502, "Fourier World \u7EC4\u4EF6\u54CD\u5E94\u683C\u5F0F\u65E0\u6548", value);
  }
  return Object.freeze({
    id: data.id,
    namespace: data.namespace,
    name: data.name,
    version: data.version,
    status: data.status
  });
}
function requiredString2(source, key) {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
  }
  return value;
}
function finiteNumber(source, key) {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u6709\u9650\u6570\u5B57`);
  }
  return value;
}
function nonNegativeInteger(source, key) {
  const value = finiteNumber(source, key);
  if (!Number.isInteger(value) || value < 0)
    throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u975E\u8D1F\u6574\u6570`);
  return value;
}
function positiveIntegerField(source, key) {
  const value = finiteNumber(source, key);
  if (!Number.isInteger(value) || value < 1)
    throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u6B63\u6574\u6570`);
  return value;
}
function stringList(source, key) {
  const value = source[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
  }
  return Object.freeze([...value]);
}
function worldEnumList(source, key, allowed) {
  const values = stringList(source, key);
  if (!values.every((value) => allowed.includes(value))) {
    throw new TypeError(`\u5B57\u6BB5 ${key} \u5305\u542B\u672A\u77E5\u503C`);
  }
  return values;
}
function optionalNullableString(source, key) {
  const value = source[key];
  if (value === undefined || value === null || typeof value === "string")
    return value;
  throw new TypeError(`\u5B57\u6BB5 ${key} \u4E0D\u662F\u5B57\u7B26\u4E32\u6216 null`);
}
function absoluteWorldUrl(value, worldUrl, field2) {
  try {
    const url = new URL(value, `${worldUrl}/`);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw new TypeError("unsupported protocol");
    return url.href;
  } catch {
    throw new TypeError(`\u5B57\u6BB5 ${field2} \u4E0D\u662F\u6709\u6548\u7684 http/https URL`);
  }
}
function searchMedia(value, worldUrl, field2) {
  if (value === null)
    return null;
  const data = object(value);
  if (data === undefined)
    throw new TypeError(`\u5B57\u6BB5 ${field2} \u4E0D\u662F\u5A92\u4F53\u5BF9\u8C61\u6216 null`);
  const mimeType = optionalNullableString(data, "mimeType");
  return Object.freeze({
    url: absoluteWorldUrl(requiredString2(data, "url"), worldUrl, `${field2}.url`),
    alt: requiredString2(data, "alt"),
    ...mimeType === undefined ? {} : { mimeType }
  });
}
function searchAuthor(value, worldUrl) {
  if (value === null)
    return null;
  const data = object(value);
  if (data === undefined)
    throw new TypeError("\u5B57\u6BB5 author \u4E0D\u662F\u4F5C\u8005\u5BF9\u8C61\u6216 null");
  if (typeof data.id !== "string" && typeof data.id !== "number" || typeof data.id === "string" && data.id.length === 0 || typeof data.id === "number" && !Number.isFinite(data.id)) {
    throw new TypeError("\u5B57\u6BB5 author.id \u4E0D\u662F\u5B57\u7B26\u4E32\u6216\u6570\u5B57");
  }
  const bio = optionalNullableString(data, "bio");
  const avatarUrl = optionalNullableString(data, "avatarUrl");
  if (data.verified !== undefined && data.verified !== null && typeof data.verified !== "boolean") {
    throw new TypeError("\u5B57\u6BB5 author.verified \u4E0D\u662F\u5E03\u5C14\u503C\u6216 null");
  }
  return Object.freeze({
    id: data.id,
    name: requiredString2(data, "name"),
    namespace: requiredString2(data, "namespace"),
    ...bio === undefined ? {} : { bio },
    ...data.verified === undefined ? {} : { verified: data.verified },
    ...avatarUrl === undefined ? {} : { avatarUrl: avatarUrl === null ? null : absoluteWorldUrl(avatarUrl, worldUrl, "author.avatarUrl") }
  });
}
function searchMetrics(value) {
  const data = object(value);
  if (data === undefined)
    throw new TypeError("\u5B57\u6BB5 metrics \u4E0D\u662F\u5BF9\u8C61");
  const qualityScore = finiteNumber(data, "qualityScore");
  if (qualityScore < 0 || qualityScore > 1)
    throw new TypeError("\u5B57\u6BB5 metrics.qualityScore \u5FC5\u987B\u4F4D\u4E8E 0\u20141");
  return Object.freeze({
    viewCount: nonNegativeInteger(data, "viewCount"),
    clickCount: nonNegativeInteger(data, "clickCount"),
    favoriteCount: nonNegativeInteger(data, "favoriteCount"),
    adoptionCount: nonNegativeInteger(data, "adoptionCount"),
    qualityScore
  });
}
function searchMatch(value) {
  const data = object(value);
  if (data === undefined)
    throw new TypeError("\u5B57\u6BB5 match \u4E0D\u662F\u5BF9\u8C61");
  const score = finiteNumber(data, "score");
  if (score < 0 || score > 1)
    throw new TypeError("\u5B57\u6BB5 match.score \u5FC5\u987B\u4F4D\u4E8E 0\u20141");
  const semanticScore = finiteNumber(data, "semanticScore");
  if (semanticScore < 0 || semanticScore > 1) {
    throw new TypeError("\u5B57\u6BB5 match.semanticScore \u5FC5\u987B\u4F4D\u4E8E 0\u20141");
  }
  return Object.freeze({
    score,
    reasons: stringList(data, "reasons"),
    keywordScore: finiteNumber(data, "keywordScore"),
    semanticScore
  });
}
function searchResult(value, worldUrl) {
  const data = object(value);
  if (data === undefined)
    throw new TypeError("\u68C0\u7D22\u7ED3\u679C\u4E0D\u662F\u5BF9\u8C61");
  if (typeof data.id !== "string" && typeof data.id !== "number" || typeof data.id === "string" && data.id.length === 0 || typeof data.id === "number" && !Number.isFinite(data.id)) {
    throw new TypeError("\u5B57\u6BB5 id \u4E0D\u662F\u5B57\u7B26\u4E32\u6216\u6570\u5B57");
  }
  if (data.downloadable !== true && data.downloadable !== false) {
    throw new TypeError("\u5B57\u6BB5 downloadable \u4E0D\u662F\u5E03\u5C14\u503C");
  }
  if (!WORLD_COMPONENT_TYPES.includes(data.type)) {
    throw new TypeError("\u5B57\u6BB5 type \u4E0D\u662F\u5DF2\u77E5\u7684 Fourier World \u7EC4\u4EF6\u7C7B\u578B");
  }
  if (data.license !== "MIT")
    throw new TypeError("\u5B57\u6BB5 license \u4E0D\u662F MIT");
  const subtype = optionalNullableString(data, "subtype");
  const styles = worldEnumList(data, "style", WORLD_STYLES);
  const name = requiredString2(data, "name");
  const namespace = requiredString2(data, "namespace");
  const packageName = requiredString2(data, "packageName");
  if (packageName !== `${namespace}/${name}`) {
    throw new TypeError("\u5B57\u6BB5 packageName \u4E0E namespace/name \u4E0D\u4E00\u81F4");
  }
  const npmPackageUrl = requiredString2(data, "npmPackageUrl");
  const npmComponentUrl = requiredString2(data, "npmComponentUrl");
  const version = requiredString2(data, "version");
  const parsedNpmPackage = parseNpmPackageReference(npmPackageUrl);
  const parsedNpmComponent = parseNpmPackageReference(npmComponentUrl);
  if (parsedNpmPackage.componentName !== undefined || parsedNpmComponent.packageUrl !== parsedNpmPackage.packageUrl || parsedNpmComponent.componentName !== name || parsedNpmPackage.namespace !== namespace || parsedNpmPackage.version !== version) {
    throw new TypeError("npmPackageUrl/npmComponentUrl \u4E0E\u7EC4\u4EF6\u8EAB\u4EFD\u4E0D\u4E00\u81F4");
  }
  return Object.freeze({
    id: data.id,
    name,
    namespace,
    packageName,
    npmPackageUrl,
    npmComponentUrl,
    downloadable: data.downloadable,
    version,
    type: data.type,
    ...subtype === undefined ? {} : { subtype },
    summary: requiredString2(data, "summary"),
    description: requiredString2(data, "description"),
    instruction: requiredString2(data, "instruction"),
    styles,
    useCases: stringList(data, "useCases"),
    negativeUseCases: stringList(data, "negativeUseCases"),
    aliases: stringList(data, "aliases"),
    tags: stringList(data, "tags"),
    contentDomains: stringList(data, "contentDomains"),
    moods: worldEnumList(data, "mood", WORLD_MOODS),
    languages: worldEnumList(data, "languages", WORLD_LANGUAGES),
    license: "MIT",
    author: searchAuthor(data.author, worldUrl),
    cover: searchMedia(data.cover, worldUrl, "cover"),
    preview: searchMedia(data.preview, worldUrl, "preview"),
    metrics: searchMetrics(data.metrics),
    createdAt: requiredString2(data, "createdAt"),
    updatedAt: requiredString2(data, "updatedAt"),
    match: searchMatch(data.match)
  });
}
function searchResponse(value, worldUrl) {
  const data = object(value);
  if (data === undefined || !Array.isArray(data.docs)) {
    throw new TypeError("\u68C0\u7D22\u54CD\u5E94\u7F3A\u5C11 docs \u6570\u7EC4");
  }
  if (data.mode !== "hybrid")
    throw new TypeError("\u68C0\u7D22\u54CD\u5E94 mode \u4E0D\u662F hybrid");
  if (data.queryId !== undefined && typeof data.queryId !== "string" && typeof data.queryId !== "number") {
    throw new TypeError("\u68C0\u7D22\u54CD\u5E94 queryId \u4E0D\u662F\u5B57\u7B26\u4E32\u6216\u6570\u5B57");
  }
  return Object.freeze({
    results: Object.freeze(data.docs.map((item) => searchResult(item, worldUrl))),
    total: nonNegativeInteger(data, "total"),
    page: positiveIntegerField(data, "page"),
    limit: positiveIntegerField(data, "limit"),
    ...data.queryId === undefined ? {} : { queryId: data.queryId },
    latencyMs: nonNegativeInteger(data, "latencyMs"),
    mode: "hybrid"
  });
}
function positiveInteger2(value, fallback, label, maximum) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1 || maximum !== undefined && resolved > maximum) {
    throw new TypeError(`${label} \u5FC5\u987B\u662F 1\u2014${maximum ?? "\u221E"} \u7684\u6574\u6570`);
  }
  return resolved;
}
function trimmedList(values, label) {
  if (values === undefined)
    return [];
  const result = values.map((value) => value.trim());
  if (result.some((value) => value.length === 0))
    throw new TypeError(`${label} \u4E0D\u80FD\u5305\u542B\u7A7A\u5B57\u7B26\u4E32`);
  return [...new Set(result)];
}
function enumList(values, allowed, label) {
  if (values === undefined)
    return [];
  if (values.some((value) => !allowed.includes(value)))
    throw new TypeError(`${label} \u5305\u542B\u4E0D\u652F\u6301\u7684\u503C`);
  return [...new Set(values)];
}

class FourierWorldClient {
  worldUrl;
  token;
  fetcher;
  constructor(options = {}) {
    this.worldUrl = normalizeWorldUrl(options.worldUrl ?? DEFAULT_FOURIER_WORLD_URL);
    const token = options.token === undefined ? undefined : normalizeToken(options.token);
    this.token = token && token.length > 0 ? token : undefined;
    this.fetcher = options.fetch ?? globalThis.fetch;
  }
  async fetchResponse(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (this.token !== undefined)
      headers.set("authorization", `JWT ${this.token}`);
    return this.fetcher(new URL(path, `${this.worldUrl}/`), {
      ...init,
      headers,
      redirect: "error"
    });
  }
  async request(path, init = {}) {
    const response = await this.fetchResponse(path, init);
    const body = await responseBody2(response);
    if (!response.ok) {
      throw new FourierWorldApiError(response.status, errorMessage(response.status, body), body);
    }
    return body;
  }
  async login(email, password) {
    const body = await this.request("api/users/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return loginResult(body);
  }
  async currentUser() {
    if (this.token === undefined)
      throw new TypeError("Fourier World token \u7F3A\u5931");
    const body = object(await this.request("api/users/me"));
    const user = object(body?.user);
    if (typeof user?.id !== "string" && typeof user?.id !== "number" || typeof user.email !== "string" || typeof user.name !== "string" || user.role !== "admin" && user.role !== "reviewer" && user.role !== "user") {
      throw new FourierWorldApiError(502, "Fourier World \u5F53\u524D\u7528\u6237\u54CD\u5E94\u683C\u5F0F\u65E0\u6548", body);
    }
    return Object.freeze({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
  }
  async search(query, options = {}) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0 || normalizedQuery.length > 500) {
      throw new TypeError("Search query \u5FC5\u987B\u662F 1\u2014500 \u4E2A\u5B57\u7B26");
    }
    if (options.type !== undefined && !WORLD_COMPONENT_TYPES.includes(options.type)) {
      throw new TypeError("type \u4E0D\u662F\u5DF2\u77E5\u7684 Fourier World \u7EC4\u4EF6\u7C7B\u578B");
    }
    if (options.license !== undefined && options.license !== "MIT") {
      throw new TypeError("license \u53EA\u652F\u6301 MIT");
    }
    const author = options.author?.trim();
    if (options.author !== undefined && author?.length === 0)
      throw new TypeError("author \u4E0D\u80FD\u4E3A\u7A7A");
    const sessionId = options.sessionId?.trim();
    if (options.sessionId !== undefined && (sessionId === undefined || sessionId.length === 0 || sessionId.length > 100)) {
      throw new TypeError("sessionId \u5FC5\u987B\u662F 1\u2014100 \u4E2A\u5B57\u7B26");
    }
    const queryParams = new URLSearchParams({
      q: normalizedQuery,
      page: String(positiveInteger2(options.page, 1, "page")),
      limit: String(positiveInteger2(options.limit, 12, "limit", 48))
    });
    if (options.type !== undefined)
      queryParams.set("type", options.type);
    for (const style of enumList(options.styles, WORLD_STYLES, "styles"))
      queryParams.append("style", style);
    for (const domain of trimmedList(options.contentDomains, "contentDomains")) {
      queryParams.append("domain", domain);
    }
    for (const mood of enumList(options.moods, WORLD_MOODS, "moods"))
      queryParams.append("mood", mood);
    for (const language of enumList(options.languages, WORLD_LANGUAGES, "languages")) {
      queryParams.append("language", language);
    }
    if (options.license !== undefined)
      queryParams.set("license", options.license);
    if (author !== undefined)
      queryParams.set("author", author);
    if (sessionId !== undefined)
      queryParams.set("sessionId", sessionId);
    const body = await this.request(`api/search?${queryParams}`, options.signal === undefined ? {} : { signal: options.signal });
    try {
      return searchResponse(body, this.worldUrl);
    } catch (error) {
      throw new FourierWorldApiError(502, `Fourier World \u68C0\u7D22\u54CD\u5E94\u683C\u5F0F\u65E0\u6548: ${error instanceof Error ? error.message : String(error)}`, body);
    }
  }
  async publish(prepared) {
    if (this.token === undefined)
      throw new TypeError("Fourier World token \u7F3A\u5931");
    const user = await this.currentUser();
    if (user.role !== "user" || user.name !== prepared.npmPackage.reference.namespace) {
      throw new FourierWorldApiError(403, `npm scope \u5FC5\u987B\u7B49\u4E8E\u5F53\u524D\u666E\u901A\u7528\u6237 namespace ${user.name}`);
    }
    const uploadedMedia = [];
    const cleanup = async () => {
      await Promise.all(uploadedMedia.map((id) => this.request(`api/media/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {
        return;
      })));
    };
    try {
      const previews = [];
      for (const component of prepared.components) {
        const preview = component.preview;
        if (preview.bytes.byteLength < 1 || preview.bytes.byteLength > MAX_WORLD_PREVIEW_BYTES) {
          throw new TypeError(`Fourier World \u9884\u89C8 MP4 \u5FC5\u987B\u4E3A 1\u2014${MAX_WORLD_PREVIEW_BYTES} bytes`);
        }
        const form = new FormData;
        form.append("_payload", JSON.stringify({ alt: `${component.artifact.name} \xB7 Fourier preview` }));
        form.append("file", new File([Uint8Array.from(preview.bytes).buffer], `${component.artifact.name}-${prepared.npmPackage.reference.version}-preview.mp4`, { type: preview.mimeType }));
        const uploaded = object(await this.request("api/media", { method: "POST", body: form }));
        const doc = object(uploaded?.doc) ?? uploaded;
        if (typeof doc?.id !== "string" && typeof doc?.id !== "number") {
          throw new FourierWorldApiError(502, "Fourier World \u9884\u89C8\u4E0A\u4F20\u54CD\u5E94\u683C\u5F0F\u65E0\u6548", uploaded);
        }
        uploadedMedia.push(doc.id);
        previews.push({ name: component.artifact.name, mediaId: doc.id });
      }
      const body = object(await this.request("api/npm-packages/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          npmPackageUrl: prepared.npmPackage.reference.packageUrl,
          integrity: prepared.npmPackage.integrity,
          fileCount: prepared.npmPackage.fileCount,
          unpackedSize: prepared.npmPackage.unpackedSize,
          previews
        })
      }));
      if (body === undefined || typeof body.created !== "boolean" || typeof body.packageId !== "string" && typeof body.packageId !== "number" || !Array.isArray(body.components)) {
        throw new FourierWorldApiError(502, "Fourier World npm \u53D1\u5E03\u54CD\u5E94\u683C\u5F0F\u65E0\u6548", body);
      }
      return Object.freeze({
        created: body.created,
        packageId: body.packageId,
        components: Object.freeze(body.components.map(componentRecord))
      });
    } catch (error) {
      await cleanup();
      throw error;
    }
  }
  async approvedNpmPackage(npmUrl) {
    const reference = parseNpmPackageReference(npmUrl);
    const query = new URLSearchParams({ url: reference.componentUrl ?? reference.packageUrl });
    const body = object(await this.request(`api/npm-packages/resolve?${query}`));
    if (body === undefined || body.npmPackageUrl !== reference.packageUrl || typeof body.integrity !== "string" || !body.integrity.startsWith("sha512-") || !Array.isArray(body.components)) {
      throw new FourierWorldApiError(502, "Fourier World npm release \u54CD\u5E94\u683C\u5F0F\u65E0\u6548", body);
    }
    const components = body.components.map((value) => {
      const item = object(value);
      if (typeof item?.name !== "string" || typeof item.npmComponentUrl !== "string") {
        throw new FourierWorldApiError(502, "Fourier World npm component \u54CD\u5E94\u683C\u5F0F\u65E0\u6548", value);
      }
      const parsed = parseNpmPackageReference(item.npmComponentUrl);
      if (parsed.packageUrl !== reference.packageUrl || parsed.componentName !== item.name) {
        throw new FourierWorldApiError(502, "Fourier World npm component \u8EAB\u4EFD\u4E0D\u4E00\u81F4", value);
      }
      return Object.freeze({ name: item.name, npmComponentUrl: item.npmComponentUrl });
    });
    if (components.length < 1 || components.length > 50 || new Set(components.map((item) => item.name)).size !== components.length) {
      throw new FourierWorldApiError(502, "Fourier World npm release \u7EC4\u4EF6\u5217\u8868\u65E0\u6548", body);
    }
    if (reference.componentName !== undefined && (components.length !== 1 || components[0]?.name !== reference.componentName)) {
      throw new FourierWorldApiError(404, `Fourier World \u672A\u53D1\u5E03\u7EC4\u4EF6 ${reference.componentName}`, body);
    }
    return Object.freeze({
      npmPackageUrl: reference.packageUrl,
      integrity: body.integrity,
      components: Object.freeze(components)
    });
  }
}

// src/search.ts
async function searchFourierWorld(query, options = {}) {
  const client = new FourierWorldClient({
    worldUrl: options.worldUrl ?? DEFAULT_FOURIER_WORLD_URL,
    ...options.fetch === undefined ? {} : { fetch: options.fetch }
  });
  return client.search(query, options);
}

// src/cli.ts
import { createInterface } from "readline/promises";
import { resolve as resolve6 } from "path";

// src/world-credentials.ts
import { randomUUID as randomUUID2 } from "crypto";
import { chmod, mkdir as mkdir2, readFile as readFile2, rename, rm as rm3, writeFile } from "fs/promises";
import { homedir } from "os";
import { join as join3, resolve as resolve3 } from "path";
function worldConfigDirectory(environment = process.env) {
  const configured = environment.FOURIER_CONFIG_DIR;
  return configured && configured.trim().length > 0 ? resolve3(configured) : join3(homedir(), ".config", "fourier");
}
function worldCredentialsPath(environment = process.env) {
  return join3(worldConfigDirectory(environment), "credentials.json");
}
function isUser(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const user = value;
  return (typeof user.id === "string" || typeof user.id === "number") && typeof user.email === "string" && typeof user.name === "string" && (user.role === "admin" || user.role === "reviewer" || user.role === "user");
}
function parseCredentials(value, path) {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(`Fourier World \u767B\u5F55\u6587\u4EF6\u683C\u5F0F\u65E0\u6548: ${path}`);
  }
  const item = value;
  if (item.version !== 1 || typeof item.worldUrl !== "string" || typeof item.token !== "string" || item.token.length === 0 || !isUser(item.user) || item.expiresAt !== undefined && typeof item.expiresAt !== "number") {
    throw new TypeError(`Fourier World \u767B\u5F55\u6587\u4EF6\u683C\u5F0F\u65E0\u6548: ${path}`);
  }
  return Object.freeze({
    version: 1,
    worldUrl: normalizeWorldUrl(item.worldUrl),
    token: item.token,
    ...item.expiresAt === undefined ? {} : { expiresAt: item.expiresAt },
    user: Object.freeze({ ...item.user })
  });
}
async function saveWorldCredentials(worldUrl, login, environment = process.env) {
  const directory = worldConfigDirectory(environment);
  const path = worldCredentialsPath(environment);
  const temporaryPath = join3(directory, `.credentials-${process.pid}-${randomUUID2()}.tmp`);
  const credentials = {
    version: 1,
    worldUrl: normalizeWorldUrl(worldUrl),
    token: login.token,
    ...login.exp === undefined ? {} : { expiresAt: login.exp },
    user: login.user
  };
  await mkdir2(directory, { recursive: true, mode: 448 });
  await chmod(directory, 448);
  try {
    await writeFile(temporaryPath, `${JSON.stringify(credentials, null, 2)}
`, { mode: 384 });
    await rename(temporaryPath, path);
    await chmod(path, 384);
  } catch (error) {
    await rm3(temporaryPath, { force: true }).catch(() => {
      return;
    });
    throw error;
  }
  return path;
}
async function readWorldCredentials(environment = process.env) {
  const path = worldCredentialsPath(environment);
  let source;
  try {
    source = await readFile2(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT")
      return;
    throw error;
  }
  try {
    return parseCredentials(JSON.parse(source), path);
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new TypeError(`Fourier World \u767B\u5F55\u6587\u4EF6\u4E0D\u662F\u6709\u6548 JSON: ${path}`);
    throw error;
  }
}
async function removeWorldCredentials(environment = process.env) {
  const path = worldCredentialsPath(environment);
  try {
    await rm3(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT")
      return false;
    throw error;
  }
}

// src/world-publish.ts
import { realpath as realpath2, stat as stat3 } from "fs/promises";
import { isAbsolute as isAbsolute3, relative as relative3, resolve as resolve4 } from "path";
var { compileVisualArtifact: compileVisualArtifact2 } = sdkArtifactHost;
function isInside2(parent, child) {
  const path = relative3(parent, child);
  return path.length === 0 || !path.startsWith("..") && !isAbsolute3(path);
}
async function assertDeclaredDependencies(componentPackage, dependencies) {
  const root = await realpath2(componentPackage.rootDirectory);
  const declared = await Promise.all(componentPackage.manifest.files.map(async (path) => {
    try {
      const candidate = await realpath2(resolve4(root, path));
      if (!isInside2(root, candidate))
        throw new TypeError(`files \u8DEF\u5F84\u9003\u9038 package \u76EE\u5F55: ${path}`);
      return { path: candidate, directory: (await stat3(candidate)).isDirectory() };
    } catch (error) {
      if (error instanceof TypeError)
        throw error;
      throw new TypeError(`files \u58F0\u660E\u7684\u8DEF\u5F84\u4E0D\u5B58\u5728: ${path}`);
    }
  }));
  for (const dependency of dependencies) {
    const candidate = await realpath2(dependency);
    if (!isInside2(root, candidate))
      throw new TypeError(`artifact \u4F9D\u8D56\u4F4D\u4E8E\u7EC4\u4EF6 package \u4E4B\u5916: ${dependency}`);
    if (!declared.some((item) => candidate === item.path || item.directory && isInside2(item.path, candidate))) {
      throw new TypeError(`artifact \u4F9D\u8D56\u672A\u5305\u542B\u5728 package.json files \u4E2D: ${relative3(root, candidate)}`);
    }
  }
}
async function prepareWorldPackage(npmUrl, fetcher = globalThis.fetch) {
  const npmPackage = await resolveNpmPackage(npmUrl, fetcher);
  if (npmPackage.reference.componentName !== undefined) {
    await npmPackage.cleanup();
    throw new TypeError("publish \u53EA\u63A5\u53D7\u4E0D\u5E26 #ComponentName \u7684 npm package URL");
  }
  try {
    const components = [];
    for (const componentPackage of npmPackage.components) {
      const compiled = await compileVisualArtifact2({ entryPath: componentPackage.entryPath });
      if (compiled.kind !== "react" && compiled.kind !== "motion" && compiled.kind !== "shader") {
        throw new TypeError(`Fourier World \u7EC4\u4EF6 ${compiled.name} \u53EA\u652F\u6301 React\u3001Motion \u6216 Shader artifact`);
      }
      if (compiled.name !== componentPackage.componentName) {
        throw new TypeError(`${componentPackage.manifest.name} \u4E0E artifact definition.name ${compiled.name} \u4E0D\u4E00\u81F4`);
      }
      const manifestType = componentPackage.manifest.fourier.type;
      if (compiled.kind === "motion" && manifestType !== "motion") {
        throw new TypeError(`Motion artifact ${compiled.name} \u7684 fourier.type \u5FC5\u987B\u662F motion`);
      }
      if (compiled.kind === "shader" && manifestType !== "shader") {
        throw new TypeError(`Shader artifact ${compiled.name} \u7684 fourier.type \u5FC5\u987B\u662F shader`);
      }
      if (compiled.kind === "react" && (manifestType === "motion" || manifestType === "shader")) {
        throw new TypeError(`React artifact ${compiled.name} \u7684 fourier.type \u4E0D\u80FD\u662F ${manifestType}`);
      }
      await assertDeclaredDependencies(componentPackage, compiled.dependencies);
      components.push(Object.freeze({
        componentPackage,
        preview: await renderWorldPreviewVideo(compiled),
        artifact: Object.freeze({
          name: compiled.name,
          kind: compiled.kind,
          sdkAbiVersion: compiled.sdkAbiVersion,
          renderer: compiled.renderer,
          dependencies: compiled.dependencies
        })
      }));
    }
    return Object.freeze({
      npmPackage,
      components: Object.freeze(components),
      cleanup: () => npmPackage.cleanup()
    });
  } catch (error) {
    await npmPackage.cleanup();
    throw error;
  }
}

// src/world-project.ts
import { randomUUID as randomUUID3 } from "crypto";
import { cp, mkdir as mkdir3, readFile as readFile3, realpath as realpath3, rename as rename2, rm as rm4, stat as stat4, writeFile as writeFile2 } from "fs/promises";
import { dirname as dirname4, isAbsolute as isAbsolute4, join as join4, relative as relative4, resolve as resolve5 } from "path";
var WORLD_PROJECT_LOCK = ".fourier-world.json";
function isInside3(parent, child) {
  const path = relative4(parent, child);
  return path.length === 0 || !path.startsWith("..") && !isAbsolute4(path);
}
function portablePath(value) {
  return value.replaceAll("\\", "/");
}
function installedComponent(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const item = value;
  if (typeof item.version !== "string" || typeof item.path !== "string" || typeof item.worldUrl !== "string" || typeof item.npmPackageUrl !== "string" || typeof item.npmComponentUrl !== "string" || typeof item.integrity !== "string" || !item.integrity.startsWith("sha512-") || typeof item.installedAt !== "string")
    return false;
  try {
    const packageReference = parseNpmPackageReference(item.npmPackageUrl);
    const componentReference = parseNpmPackageReference(item.npmComponentUrl);
    return packageReference.componentName === undefined && componentReference.packageUrl === packageReference.packageUrl;
  } catch {
    return false;
  }
}
async function readLock(projectDirectory) {
  const path = join4(projectDirectory, WORLD_PROJECT_LOCK);
  let source;
  try {
    source = await readFile3(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return Object.freeze({ version: 2, components: Object.freeze({}) });
    }
    throw error;
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new TypeError(`\u9879\u76EE\u5B89\u88C5\u6E05\u5355\u4E0D\u662F\u6709\u6548 JSON: ${path}`);
  }
  if (typeof value !== "object" || value === null)
    throw new TypeError(`\u9879\u76EE\u5B89\u88C5\u6E05\u5355\u683C\u5F0F\u65E0\u6548: ${path}`);
  const item = value;
  if (item.version === 1)
    throw new TypeError(`${WORLD_PROJECT_LOCK} v1 \u6CA1\u6709 npm \u6765\u6E90\uFF1B\u8BF7\u5220\u9664\u65E7\u7EC4\u4EF6\u540E\u7528\u7CBE\u786E npm URL \u91CD\u65B0\u5B89\u88C5`);
  if (item.version !== 2 || typeof item.components !== "object" || item.components === null || Array.isArray(item.components)) {
    throw new TypeError(`\u9879\u76EE\u5B89\u88C5\u6E05\u5355\u683C\u5F0F\u65E0\u6548: ${path}`);
  }
  const components = {};
  for (const [packageName, component] of Object.entries(item.components)) {
    if (!/^@[a-z0-9][a-z0-9._-]*\/[A-Za-z][A-Za-z0-9_-]*$/.test(packageName) || !installedComponent(component)) {
      throw new TypeError(`\u9879\u76EE\u5B89\u88C5\u6E05\u5355\u4E2D\u7684 ${packageName} \u683C\u5F0F\u65E0\u6548`);
    }
    const reference = parseNpmPackageReference(component.npmComponentUrl);
    if (reference.componentName === undefined || `${reference.namespace}/${reference.componentName}` !== packageName || reference.version !== component.version) {
      throw new TypeError(`\u9879\u76EE\u5B89\u88C5\u6E05\u5355\u4E2D\u7684 ${packageName} npm \u8EAB\u4EFD\u4E0D\u4E00\u81F4`);
    }
    components[packageName] = Object.freeze({ ...component });
  }
  return Object.freeze({ version: 2, components: Object.freeze(components) });
}
async function writeLock(projectDirectory, components) {
  const path = join4(projectDirectory, WORLD_PROJECT_LOCK);
  const temporaryPath = join4(projectDirectory, `.${WORLD_PROJECT_LOCK}-${process.pid}-${randomUUID3()}.tmp`);
  const sorted = Object.fromEntries(Object.entries(components).sort(([left], [right]) => left.localeCompare(right)));
  try {
    await writeFile2(temporaryPath, `${JSON.stringify({ version: 2, components: sorted }, null, 2)}
`, { mode: 384 });
    await rename2(temporaryPath, path);
  } catch (error) {
    await rm4(temporaryPath, { force: true }).catch(() => {
      return;
    });
    throw error;
  }
}
async function existingDirectory(path, label) {
  let info;
  try {
    info = await stat4(path);
  } catch (error) {
    if (error.code === "ENOENT")
      throw new TypeError(`${label}\u4E0D\u5B58\u5728: ${path}`);
    throw error;
  }
  if (!info.isDirectory())
    throw new TypeError(`${label}\u5FC5\u987B\u662F\u76EE\u5F55: ${path}`);
  return realpath3(path);
}
async function assertManagedTarget(projectDirectory, target) {
  if (!isInside3(projectDirectory, target) || target === projectDirectory)
    throw new TypeError("\u7EC4\u4EF6\u5B89\u88C5\u8DEF\u5F84\u65E0\u6548");
  let candidate = target;
  while (true) {
    try {
      if (!isInside3(projectDirectory, await realpath3(candidate)))
        throw new TypeError("\u7EC4\u4EF6\u5B89\u88C5\u8DEF\u5F84\u4E0D\u80FD\u901A\u8FC7\u7B26\u53F7\u94FE\u63A5\u9003\u9038\u9879\u76EE\u76EE\u5F55");
      return;
    } catch (error) {
      if (error instanceof TypeError)
        throw error;
      if (error.code !== "ENOENT")
        throw error;
      const parent = dirname4(candidate);
      if (parent === candidate)
        throw new TypeError("\u7EC4\u4EF6\u5B89\u88C5\u8DEF\u5F84\u65E0\u6548");
      candidate = parent;
    }
  }
}
async function copyComponent(component, target) {
  await mkdir3(target, { recursive: true, mode: 448 });
  await cp(component.packagePath, join4(target, "package.json"));
  for (const declared of component.manifest.files) {
    const source = resolve5(component.rootDirectory, declared);
    if (!isInside3(component.rootDirectory, source))
      throw new TypeError(`\u7EC4\u4EF6 files \u8DEF\u5F84\u9003\u9038: ${declared}`);
    await cp(source, resolve5(target, declared), { recursive: true });
  }
}
async function addWorldComponent(options) {
  const reference = parseNpmPackageReference(options.npmUrl);
  const projectDirectory = await existingDirectory(resolve5(options.projectDirectory ?? process.cwd()), "\u9879\u76EE\u76EE\u5F55");
  const componentsDirectory = resolve5(projectDirectory, options.componentsDirectory ?? "components");
  if (!isInside3(projectDirectory, componentsDirectory))
    throw new TypeError("\u7EC4\u4EF6\u76EE\u5F55\u5FC5\u987B\u4F4D\u4E8E\u9879\u76EE\u76EE\u5F55\u5185");
  const lock = await readLock(projectDirectory);
  const client = new FourierWorldClient({
    worldUrl: options.worldUrl,
    ...options.fetch === undefined ? {} : { fetch: options.fetch }
  });
  const approved = await client.approvedNpmPackage(options.npmUrl);
  const npmPackage = await resolveNpmPackage(options.npmUrl, options.fetch ?? globalThis.fetch);
  try {
    if (npmPackage.integrity !== approved.integrity)
      throw new TypeError("Fourier World \u6279\u51C6\u7684 integrity \u4E0E npm registry \u4E0D\u4E00\u81F4");
    const selected = npmPackage.components.filter((component) => reference.componentName === undefined ? true : component.componentName === reference.componentName);
    if (selected.length === 0)
      throw new TypeError("npm package \u6CA1\u6709\u53EF\u5B89\u88C5\u7EC4\u4EF6");
    const approvedNames = new Set(approved.components.map((component) => component.name));
    if (selected.some((component) => !approvedNames.has(component.componentName))) {
      throw new TypeError("npm package \u5305\u542B Fourier World \u672A\u6279\u51C6\u7684\u7EC4\u4EF6");
    }
    const selectedNames = new Set(selected.map((component) => component.manifest.name));
    const obsoleteEntries = reference.componentName === undefined ? Object.entries(lock.components).filter(([packageName, installed]) => parseNpmPackageReference(installed.npmPackageUrl).packageName === reference.packageName && !selectedNames.has(packageName)) : [];
    const obsolete = await Promise.all(obsoleteEntries.map(async ([packageName, installed]) => {
      const target = resolve5(projectDirectory, installed.path);
      await assertManagedTarget(projectDirectory, target);
      let exists = true;
      try {
        await stat4(target);
        const local = JSON.parse(await readFile3(join4(target, "package.json"), "utf8"));
        if (local.name !== packageName)
          throw new TypeError(`\u5DF2\u5B89\u88C5\u76EE\u5F55\u7684 package name \u4E0D\u5339\u914D\uFF0C\u62D2\u7EDD\u66FF\u6362: ${target}`);
      } catch (error) {
        if (error.code === "ENOENT")
          exists = false;
        else
          throw error;
      }
      return { packageName, target, exists };
    }));
    const operations = await Promise.all(selected.map(async (component) => {
      const packageName = component.manifest.name;
      const existing = lock.components[packageName];
      const target = existing === undefined ? resolve5(componentsDirectory, component.namespace, component.componentName) : resolve5(projectDirectory, existing.path);
      await assertManagedTarget(projectDirectory, target);
      let unchanged = false;
      if (existing?.integrity === npmPackage.integrity && existing.npmComponentUrl === `${reference.packageUrl}#${component.componentName}`) {
        try {
          const local = JSON.parse(await readFile3(join4(target, "package.json"), "utf8"));
          unchanged = local.name === packageName && local.version === reference.version;
        } catch {}
      }
      return { component, packageName, existing, target, unchanged };
    }));
    const targets = [...operations.map((operation) => operation.target), ...obsolete.map((operation) => operation.target)];
    if (new Set(targets).size !== targets.length)
      throw new TypeError("\u5B89\u88C5\u6E05\u5355\u5305\u542B\u51B2\u7A81\u7684\u7EC4\u4EF6\u8DEF\u5F84");
    if (operations.every((operation) => operation.unchanged) && obsolete.length === 0) {
      return Object.freeze({
        npmPackageUrl: reference.packageUrl,
        components: Object.freeze(operations.map((operation) => Object.freeze({
          packageName: operation.packageName,
          version: reference.version,
          path: operation.target,
          unchanged: true
        })))
      });
    }
    const changed = operations.filter((operation) => !operation.unchanged);
    const staged = [];
    const removed = [];
    try {
      for (const operation of changed) {
        const staging = join4(dirname4(operation.target), `.fourier-add-${randomUUID3()}`);
        const backup = join4(dirname4(operation.target), `.fourier-backup-${randomUUID3()}`);
        await copyComponent(operation.component, staging);
        let hadTarget = false;
        try {
          await stat4(operation.target);
          hadTarget = true;
        } catch (error) {
          if (error.code !== "ENOENT")
            throw error;
        }
        if (hadTarget && !options.force && operation.existing === undefined) {
          throw new TypeError(`\u76EE\u6807\u76EE\u5F55\u5DF2\u5B58\u5728: ${operation.target}\uFF1B\u5982\u9700\u66FF\u6362\u8BF7\u663E\u5F0F\u4F7F\u7528 --force`);
        }
        staged.push({ target: operation.target, staging, backup, hadTarget, backedUp: false, installed: false });
      }
      for (const operation of staged) {
        if (operation.hadTarget) {
          await rename2(operation.target, operation.backup);
          operation.backedUp = true;
        }
        await rename2(operation.staging, operation.target);
        operation.installed = true;
      }
      for (const operation of obsolete) {
        if (!operation.exists)
          continue;
        const removedOperation = {
          target: operation.target,
          backup: join4(dirname4(operation.target), `.fourier-backup-${randomUUID3()}`),
          moved: false
        };
        removed.push(removedOperation);
        await rename2(removedOperation.target, removedOperation.backup);
        removedOperation.moved = true;
      }
      const components = { ...lock.components };
      for (const operation of obsolete)
        delete components[operation.packageName];
      for (const operation of operations) {
        components[operation.packageName] = Object.freeze({
          version: reference.version,
          path: portablePath(relative4(projectDirectory, operation.target)),
          worldUrl: client.worldUrl,
          npmPackageUrl: reference.packageUrl,
          npmComponentUrl: `${reference.packageUrl}#${operation.component.componentName}`,
          integrity: npmPackage.integrity,
          installedAt: new Date().toISOString()
        });
      }
      await writeLock(projectDirectory, components);
      await Promise.all([
        ...staged.map((operation) => rm4(operation.backup, { recursive: true, force: true }).catch(() => {
          return;
        })),
        ...removed.map((operation) => rm4(operation.backup, { recursive: true, force: true }).catch(() => {
          return;
        }))
      ]);
    } catch (error) {
      for (const operation of [...removed].reverse()) {
        if (operation.moved)
          await rename2(operation.backup, operation.target).catch(() => {
            return;
          });
      }
      for (const operation of [...staged].reverse()) {
        await rm4(operation.staging, { recursive: true, force: true }).catch(() => {
          return;
        });
        if (operation.installed)
          await rm4(operation.target, { recursive: true, force: true }).catch(() => {
            return;
          });
        if (operation.backedUp) {
          await rename2(operation.backup, operation.target).catch(() => {
            return;
          });
        }
      }
      throw error;
    }
    return Object.freeze({
      npmPackageUrl: reference.packageUrl,
      components: Object.freeze(operations.map((operation) => Object.freeze({
        packageName: operation.packageName,
        version: reference.version,
        path: operation.target,
        unchanged: operation.unchanged
      })))
    });
  } finally {
    await npmPackage.cleanup();
  }
}
async function deleteWorldComponent(options) {
  const reference = parseNpmPackageReference(options.npmUrl);
  const projectDirectory = await existingDirectory(resolve5(options.projectDirectory ?? process.cwd()), "\u9879\u76EE\u76EE\u5F55");
  const lock = await readLock(projectDirectory);
  const selected = Object.entries(lock.components).filter(([, component]) => component.npmPackageUrl === reference.packageUrl && (reference.componentName === undefined || component.npmComponentUrl.endsWith(`#${reference.componentName}`)));
  if (selected.length === 0)
    throw new TypeError(`${options.npmUrl} \u4E0D\u5728 ${WORLD_PROJECT_LOCK} \u4E2D`);
  const components = { ...lock.components };
  const removed = [];
  const operations = [];
  for (const [packageName, installed] of selected) {
    const target = resolve5(projectDirectory, installed.path);
    await assertManagedTarget(projectDirectory, target);
    let exists = true;
    try {
      await stat4(target);
      const local = JSON.parse(await readFile3(join4(target, "package.json"), "utf8"));
      if (local.name !== packageName)
        throw new TypeError(`\u5DF2\u5B89\u88C5\u76EE\u5F55\u7684 package name \u4E0D\u5339\u914D\uFF0C\u62D2\u7EDD\u5220\u9664: ${target}`);
    } catch (error) {
      if (error.code === "ENOENT")
        exists = false;
      else
        throw error;
    }
    delete components[packageName];
    operations.push({ packageName, target, exists });
  }
  const trash = join4(projectDirectory, ".fourier-trash");
  try {
    if (operations.some((operation) => operation.exists))
      await mkdir3(trash, { recursive: true });
    for (const operation of operations) {
      if (!operation.exists)
        continue;
      operation.stagedPath = join4(trash, `${operation.packageName.replace(/^@/, "").replace("/", "-")}-${randomUUID3()}`);
      await rename2(operation.target, operation.stagedPath);
      if (!options.purge)
        operation.trashPath = operation.stagedPath;
    }
    await writeLock(projectDirectory, components);
  } catch (error) {
    for (const operation of [...operations].reverse()) {
      if (operation.stagedPath !== undefined)
        await rename2(operation.stagedPath, operation.target).catch(() => {
          return;
        });
    }
    throw error;
  }
  if (options.purge) {
    await Promise.all(operations.map((operation) => operation.stagedPath === undefined ? Promise.resolve() : rm4(operation.stagedPath, { recursive: true, force: true })));
  }
  for (const operation of operations) {
    removed.push(Object.freeze({
      packageName: operation.packageName,
      path: operation.target,
      ...operation.trashPath === undefined ? {} : { trashPath: operation.trashPath },
      missing: !operation.exists
    }));
  }
  return Object.freeze({ npmPackageUrl: reference.packageUrl, components: Object.freeze(removed) });
}

// src/cli.ts
var HELP = `Fourier React/Motion SDK

\u7528\u6CD5:
  fourier-sdk preview [artifact.tsx|directory] [--host <host>] [--port <port>] [--public-port <port>] [--open] [--no-watch]
  fourier-sdk login [--world <url>] [--email <email>] [--password-stdin]
  fourier-sdk whoami [--world <url>]
  fourier-sdk logout
  fourier-sdk search <\u81EA\u7136\u8BED\u8A00\u63CF\u8FF0> [--type <type>] [--style <style>] [--limit <n>] [--json] [--world <url>]
  fourier-sdk publish <npm-package-url> [--world <url>] [--dry-run]
  fourier-sdk add <npm-package-url[#ComponentName]> [--project <dir>] [--dir <dir>] [--world <url>] [--force]
  fourier-sdk del <npm-package-url[#ComponentName]> [--project <dir>] [--purge]

publish \u53EA\u63A5\u53D7 https://www.npmjs.com/package/@scope/name/v/1.2.3 \u7CBE\u786E\u7248\u672C URL\u3002
\u53D1\u5E03\u4F1A\u89E3\u6790\u5305\u5185\u5168\u90E8 Fourier \u7EC4\u4EF6\uFF0C\u9010\u4E00\u7F16\u8BD1\u5E76\u751F\u6210\u9884\u89C8\uFF0C\u518D\u63D0\u4EA4\u5230 review \u72B6\u6001\u3002
preview \u4E0D\u4F20\u5165\u53E3\u65F6\u4F1A\u52A0\u8F7D SDK example \u76EE\u5F55\u4E2D\u7684\u5168\u90E8\u7EC4\u4EF6\u3002
search \u4F7F\u7528 Fourier World \u7684\u5173\u952E\u8BCD + \u8BED\u4E49\u6DF7\u5408\u68C0\u7D22\uFF1B\u65E0\u9700\u767B\u5F55\uFF0C--json \u9002\u5408 Agent \u8C03\u7528\u3002
\u9ED8\u8BA4 World: ${DEFAULT_FOURIER_WORLD_URL}`;
function optionValue(argv, index, option) {
  const value = argv[index + 1];
  if (value === undefined || value.length === 0 || value.startsWith("-")) {
    throw new TypeError(`${option} \u7F3A\u5C11\u503C`);
  }
  return value;
}
function parsePreview(argv) {
  let entryPath = defaultPreviewSourcePath();
  let hasEntryPath = false;
  let hostname = "127.0.0.1";
  let port = 3211;
  let publicPort = 3212;
  let open = false;
  let watch2 = true;
  for (let index = 0;index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--host") {
      hostname = optionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--port") {
      port = Number(optionValue(argv, index, arg));
      index += 1;
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new TypeError("--port \u5FC5\u987B\u662F 0\u201465535 \u7684\u6574\u6570");
      }
    } else if (arg === "--public-port") {
      publicPort = Number(optionValue(argv, index, arg));
      index += 1;
      if (!Number.isInteger(publicPort) || publicPort < 0 || publicPort > 65535) {
        throw new TypeError("--public-port \u5FC5\u987B\u662F 0\u201465535 \u7684\u6574\u6570");
      }
    } else if (arg === "--open") {
      open = true;
    } else if (arg === "--no-watch") {
      watch2 = false;
    } else if (arg.startsWith("-")) {
      throw new TypeError(`\u672A\u77E5\u53C2\u6570: ${arg}`);
    } else if (!hasEntryPath) {
      entryPath = resolve6(arg);
      hasEntryPath = true;
    } else {
      throw new TypeError(`\u591A\u4F59\u4F4D\u7F6E\u53C2\u6570: ${arg}`);
    }
  }
  return { command: "preview", entryPath, hostname, port, publicPort, open, watch: watch2 };
}
function parseLogin(argv) {
  let worldUrl;
  let email;
  let passwordStdin = false;
  for (let index = 0;index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--world") {
      worldUrl = normalizeWorldUrl(optionValue(argv, index, arg));
      index += 1;
    } else if (arg === "--email") {
      email = optionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--password-stdin") {
      passwordStdin = true;
    } else {
      throw new TypeError(arg.startsWith("-") ? `\u672A\u77E5\u53C2\u6570: ${arg}` : `\u591A\u4F59\u4F4D\u7F6E\u53C2\u6570: ${arg}`);
    }
  }
  return {
    command: "login",
    ...worldUrl === undefined ? {} : { worldUrl },
    ...email === undefined ? {} : { email },
    passwordStdin
  };
}
function parseWhoami(argv) {
  let worldUrl;
  for (let index = 0;index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--world") {
      worldUrl = normalizeWorldUrl(optionValue(argv, index, arg));
      index += 1;
    } else {
      throw new TypeError(arg.startsWith("-") ? `\u672A\u77E5\u53C2\u6570: ${arg}` : `\u591A\u4F59\u4F4D\u7F6E\u53C2\u6570: ${arg}`);
    }
  }
  return { command: "whoami", ...worldUrl === undefined ? {} : { worldUrl } };
}
function enumOption(value, allowed, option) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${option} \u5FC5\u987B\u662F ${allowed.join("\u3001")}`);
  }
  return value;
}
function integerOption(value, option, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || maximum !== undefined && number > maximum) {
    throw new TypeError(`${option} \u5FC5\u987B\u662F 1\u2014${maximum ?? "\u221E"} \u7684\u6574\u6570`);
  }
  return number;
}
function parseSearch(argv) {
  const queryParts = [];
  let worldUrl;
  let type;
  const styles = [];
  const contentDomains = [];
  const moods = [];
  const languages = [];
  let author;
  let page = 1;
  let limit = 12;
  let sessionId;
  let json2 = false;
  for (let index = 0;index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--world") {
      worldUrl = normalizeWorldUrl(optionValue(argv, index, arg));
      index += 1;
    } else if (arg === "--type") {
      type = enumOption(optionValue(argv, index, arg), WORLD_COMPONENT_TYPES, arg);
      index += 1;
    } else if (arg === "--style") {
      styles.push(enumOption(optionValue(argv, index, arg), WORLD_STYLES, arg));
      index += 1;
    } else if (arg === "--domain") {
      contentDomains.push(optionValue(argv, index, arg));
      index += 1;
    } else if (arg === "--mood") {
      moods.push(enumOption(optionValue(argv, index, arg), WORLD_MOODS, arg));
      index += 1;
    } else if (arg === "--language") {
      languages.push(enumOption(optionValue(argv, index, arg), WORLD_LANGUAGES, arg));
      index += 1;
    } else if (arg === "--author") {
      author = optionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--page") {
      page = integerOption(optionValue(argv, index, arg), arg);
      index += 1;
    } else if (arg === "--limit") {
      limit = integerOption(optionValue(argv, index, arg), arg, 48);
      index += 1;
    } else if (arg === "--session") {
      sessionId = optionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--json") {
      json2 = true;
    } else if (arg.startsWith("-")) {
      throw new TypeError(`\u672A\u77E5\u53C2\u6570: ${arg}`);
    } else {
      queryParts.push(arg);
    }
  }
  const query = queryParts.join(" ").trim();
  if (query.length === 0)
    throw new TypeError("search \u7F3A\u5C11\u81EA\u7136\u8BED\u8A00\u63CF\u8FF0");
  return {
    command: "search",
    query,
    ...worldUrl === undefined ? {} : { worldUrl },
    ...type === undefined ? {} : { type },
    styles: Object.freeze([...new Set(styles)]),
    contentDomains: Object.freeze([...new Set(contentDomains)]),
    moods: Object.freeze([...new Set(moods)]),
    languages: Object.freeze([...new Set(languages)]),
    ...author === undefined ? {} : { author },
    page,
    limit,
    ...sessionId === undefined ? {} : { sessionId },
    json: json2
  };
}
function parsePublish(argv) {
  let npmUrl;
  let worldUrl;
  let dryRun = false;
  for (let index = 0;index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--world") {
      worldUrl = normalizeWorldUrl(optionValue(argv, index, arg));
      index += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("-")) {
      throw new TypeError(`\u672A\u77E5\u53C2\u6570: ${arg}`);
    } else if (npmUrl === undefined) {
      npmUrl = arg;
    } else {
      throw new TypeError(`\u591A\u4F59\u4F4D\u7F6E\u53C2\u6570: ${arg}`);
    }
  }
  if (npmUrl === undefined)
    throw new TypeError("publish \u7F3A\u5C11\u7CBE\u786E\u7248\u672C npm package URL");
  if (parseNpmPackageReference(npmUrl).componentName !== undefined) {
    throw new TypeError("publish \u4E0D\u63A5\u53D7 #ComponentName");
  }
  return {
    command: "publish",
    npmUrl,
    ...worldUrl === undefined ? {} : { worldUrl },
    dryRun
  };
}
function parseAdd(argv) {
  let npmUrl;
  let projectDirectory = process.cwd();
  let componentsDirectory = "components";
  let worldUrl;
  let force = false;
  for (let index = 0;index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      projectDirectory = resolve6(optionValue(argv, index, arg));
      index += 1;
    } else if (arg === "--dir") {
      componentsDirectory = optionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--world") {
      worldUrl = normalizeWorldUrl(optionValue(argv, index, arg));
      index += 1;
    } else if (arg === "--force") {
      force = true;
    } else if (arg.startsWith("-")) {
      throw new TypeError(`\u672A\u77E5\u53C2\u6570: ${arg}`);
    } else if (npmUrl === undefined) {
      npmUrl = arg;
    } else {
      throw new TypeError(`\u591A\u4F59\u4F4D\u7F6E\u53C2\u6570: ${arg}`);
    }
  }
  if (npmUrl === undefined)
    throw new TypeError("add \u7F3A\u5C11\u7CBE\u786E\u7248\u672C npm URL");
  parseNpmPackageReference(npmUrl);
  return {
    command: "add",
    npmUrl,
    projectDirectory,
    componentsDirectory,
    ...worldUrl === undefined ? {} : { worldUrl },
    force
  };
}
function parseDelete(argv) {
  let npmUrl;
  let projectDirectory = process.cwd();
  let purge = false;
  for (let index = 0;index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      projectDirectory = resolve6(optionValue(argv, index, arg));
      index += 1;
    } else if (arg === "--purge") {
      purge = true;
    } else if (arg.startsWith("-")) {
      throw new TypeError(`\u672A\u77E5\u53C2\u6570: ${arg}`);
    } else if (npmUrl === undefined) {
      npmUrl = arg;
    } else {
      throw new TypeError(`\u591A\u4F59\u4F4D\u7F6E\u53C2\u6570: ${arg}`);
    }
  }
  if (npmUrl === undefined)
    throw new TypeError("del \u7F3A\u5C11\u7CBE\u786E\u7248\u672C npm URL");
  parseNpmPackageReference(npmUrl);
  return { command: "del", npmUrl, projectDirectory, purge };
}
function parseCliInvocation(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h"))
    return { command: "help" };
  const [command, ...rest] = argv;
  if (command === "preview")
    return parsePreview(rest);
  if (command === "login")
    return parseLogin(rest);
  if (command === "whoami")
    return parseWhoami(rest);
  if (command === "logout") {
    if (rest.length > 0)
      throw new TypeError(`logout \u4E0D\u63A5\u53D7\u53C2\u6570: ${rest.join(" ")}`);
    return { command: "logout" };
  }
  if (command === "search")
    return parseSearch(rest);
  if (command === "publish")
    return parsePublish(rest);
  if (command === "add")
    return parseAdd(rest);
  if (command === "del" || command === "remove")
    return parseDelete(rest);
  throw new TypeError(`\u672A\u77E5\u547D\u4EE4: ${command ?? ""}`);
}
async function openBrowser(url) {
  const command = process.platform === "darwin" ? ["open", url] : process.platform === "win32" ? ["cmd", "/c", "start", "", url] : ["xdg-open", url];
  const child = Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
  await child.exited;
}
async function promptLine(label) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await readline.question(label)).trim();
  } finally {
    readline.close();
  }
}
async function promptPassword(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || process.stdin.setRawMode === undefined) {
    throw new TypeError("\u975E\u4EA4\u4E92\u7EC8\u7AEF\u8BF7\u4F7F\u7528 --password-stdin");
  }
  return new Promise((resolvePassword, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    const wasRaw = input.isRaw;
    let password = "";
    const finish = (error) => {
      input.off("data", onData);
      input.setRawMode(wasRaw);
      input.pause();
      output.write(`
`);
      if (error)
        reject(error);
      else
        resolvePassword(password);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === "\x03") {
          finish(new Error("\u5DF2\u53D6\u6D88\u767B\u5F55"));
          return;
        }
        if (character === "\r" || character === `
`) {
          finish();
          return;
        }
        if (character === "\x7F" || character === "\b") {
          password = password.slice(0, -1);
        } else {
          password += character;
        }
      }
    };
    output.write(label);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}
async function passwordFromStdin() {
  const value = (await Bun.stdin.text()).replace(/\r?\n$/, "");
  if (value.length === 0)
    throw new TypeError("stdin \u4E2D\u7684\u5BC6\u7801\u4E3A\u7A7A");
  return value;
}
async function session(explicitWorldUrl) {
  const stored = await readWorldCredentials();
  const worldUrl = normalizeWorldUrl(explicitWorldUrl ?? process.env.FOURIER_WORLD_URL ?? stored?.worldUrl ?? DEFAULT_FOURIER_WORLD_URL);
  const environmentToken = process.env.FOURIER_WORLD_TOKEN?.trim();
  if (environmentToken)
    return { worldUrl, token: environmentToken };
  if (stored === undefined)
    throw new TypeError("\u5C1A\u672A\u767B\u5F55 Fourier World\uFF0C\u8BF7\u5148\u8FD0\u884C fourier-sdk login");
  if (stored.worldUrl !== worldUrl) {
    throw new TypeError(`\u5F53\u524D\u51ED\u636E\u5C5E\u4E8E ${stored.worldUrl}\uFF0C\u8BF7\u9488\u5BF9 ${worldUrl} \u91CD\u65B0\u8FD0\u884C fourier-sdk login`);
  }
  if (stored.expiresAt !== undefined && stored.expiresAt * 1000 <= Date.now()) {
    throw new TypeError("Fourier World \u767B\u5F55\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u8FD0\u884C fourier-sdk login");
  }
  return { worldUrl, token: stored.token };
}
async function runPreview(invocation) {
  const handle = await startPreviewServer({
    entryPath: invocation.entryPath,
    hostname: invocation.hostname,
    port: invocation.port,
    publicPort: invocation.publicPort,
    watch: invocation.watch
  });
  console.log(`Fourier SDK preview: ${handle.url}`);
  if (handle.publicUrl !== undefined) {
    console.log(`Fourier SDK preview (public, CORS): ${handle.publicUrl}`);
  }
  if (invocation.open)
    openBrowser(handle.url);
  const stop = async () => {
    await handle.stop();
    process.exit(0);
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
  return await new Promise(() => {});
}
async function runLogin(invocation) {
  const worldUrl = normalizeWorldUrl(invocation.worldUrl ?? process.env.FOURIER_WORLD_URL ?? DEFAULT_FOURIER_WORLD_URL);
  const email = invocation.email ?? await promptLine("Fourier World \u90AE\u7BB1: ");
  if (email.length === 0)
    throw new TypeError("\u90AE\u7BB1\u4E0D\u80FD\u4E3A\u7A7A");
  const password = invocation.passwordStdin ? await passwordFromStdin() : await promptPassword("Fourier World \u5BC6\u7801: ");
  const login = await new FourierWorldClient({ worldUrl }).login(email, password);
  const path = await saveWorldCredentials(worldUrl, login);
  console.log(`\u2713 \u5DF2\u767B\u5F55 ${worldUrl}`);
  console.log(`  ${login.user.name} <${login.user.email}> \xB7 ${login.user.role}`);
  console.log(`  \u51ED\u636E\u5DF2\u5B89\u5168\u4FDD\u5B58\u5230 ${path}`);
}
async function runWhoami(invocation) {
  const active = await session(invocation.worldUrl);
  const user = await new FourierWorldClient(active).currentUser();
  console.log(`${user.name} <${user.email}> \xB7 ${user.role}`);
  console.log(active.worldUrl);
}
async function runSearch(invocation) {
  const worldUrl = normalizeWorldUrl(invocation.worldUrl ?? process.env.FOURIER_WORLD_URL ?? DEFAULT_FOURIER_WORLD_URL);
  const result = await searchFourierWorld(invocation.query, {
    worldUrl,
    ...invocation.type === undefined ? {} : { type: invocation.type },
    styles: invocation.styles,
    contentDomains: invocation.contentDomains,
    moods: invocation.moods,
    languages: invocation.languages,
    ...invocation.author === undefined ? {} : { author: invocation.author },
    page: invocation.page,
    limit: invocation.limit,
    ...invocation.sessionId === undefined ? {} : { sessionId: invocation.sessionId }
  });
  if (invocation.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`${result.total} \u4E2A\u5339\u914D \xB7 ${result.latencyMs} ms`);
  for (const [index, item] of result.results.entries()) {
    console.log(`${index + 1}. ${item.packageName}@${item.version} \xB7 ${(item.match.score * 100).toFixed(1)}%`);
    console.log(`   ${item.summary}`);
    console.log(`   ${item.match.reasons.join("\uFF1B")}`);
    console.log(item.downloadable ? `   fourier-sdk add ${item.npmComponentUrl}` : "   \u5F53\u524D\u7248\u672C\u6682\u4E0D\u53EF\u5B89\u88C5");
  }
}
async function runPublish(invocation) {
  const prepared = await prepareWorldPackage(invocation.npmUrl);
  try {
    console.log(`\u2713 npm package: ${prepared.npmPackage.reference.packageName}@${prepared.npmPackage.reference.version}`);
    for (const component of prepared.components) {
      console.log(`\u2713 ${component.artifact.name}: ${component.artifact.kind} \xB7 ABI v${component.artifact.sdkAbiVersion} \xB7 ${component.preview.width}\xD7${component.preview.height}`);
    }
    if (invocation.dryRun) {
      console.log(`\u2713 dry-run \u5B8C\u6210\uFF1B${prepared.components.length} \u4E2A\u7EC4\u4EF6\u5DF2\u9A8C\u8BC1\uFF0C\u672A\u5411 Fourier World \u5199\u5165\u6570\u636E`);
      return;
    }
    const active = await session(invocation.worldUrl);
    const result = await new FourierWorldClient(active).publish(prepared);
    console.log(`\u2713 ${result.created ? "\u5DF2\u521B\u5EFA" : "\u5DF2\u5B58\u5728"} ${prepared.npmPackage.reference.packageUrl}`);
    console.log(`  ${result.components.length} \u4E2A\u7EC4\u4EF6\u8FDB\u5165 review`);
  } finally {
    await prepared.cleanup();
  }
}
async function runAdd(invocation) {
  const worldUrl = normalizeWorldUrl(invocation.worldUrl ?? process.env.FOURIER_WORLD_URL ?? DEFAULT_FOURIER_WORLD_URL);
  const result = await addWorldComponent({
    npmUrl: invocation.npmUrl,
    projectDirectory: invocation.projectDirectory,
    componentsDirectory: invocation.componentsDirectory,
    worldUrl,
    force: invocation.force
  });
  for (const component of result.components) {
    console.log(component.unchanged ? `\xB7 \u5DF2\u5B89\u88C5 ${component.packageName}@${component.version}` : `\u2713 \u5DF2\u6DFB\u52A0 ${component.packageName}@${component.version}`);
    console.log(`  ${component.path}`);
  }
}
async function runDelete(invocation) {
  const result = await deleteWorldComponent({
    npmUrl: invocation.npmUrl,
    projectDirectory: invocation.projectDirectory,
    purge: invocation.purge
  });
  for (const component of result.components) {
    if (component.missing)
      console.log(`\xB7 \u7EC4\u4EF6\u76EE\u5F55\u5DF2\u4E0D\u5B58\u5728\uFF0C\u5DF2\u6E05\u7406\u5B89\u88C5\u6E05\u5355: ${component.packageName}`);
    else
      console.log(`\u2713 \u5DF2\u79FB\u9664 ${component.packageName}`);
    if (component.trashPath !== undefined)
      console.log(`  \u53EF\u6062\u590D\u526F\u672C: ${component.trashPath}`);
  }
}
async function runCli(argv) {
  try {
    const invocation = parseCliInvocation(argv);
    if (invocation.command === "help") {
      console.log(HELP);
    } else if (invocation.command === "preview") {
      await runPreview(invocation);
    } else if (invocation.command === "login") {
      await runLogin(invocation);
    } else if (invocation.command === "whoami") {
      await runWhoami(invocation);
    } else if (invocation.command === "logout") {
      const removed = await removeWorldCredentials();
      console.log(removed ? "\u2713 \u5DF2\u9000\u51FA Fourier World" : "\xB7 \u5F53\u524D\u6CA1\u6709\u5DF2\u4FDD\u5B58\u7684 Fourier World \u767B\u5F55");
    } else if (invocation.command === "search") {
      await runSearch(invocation);
    } else if (invocation.command === "publish") {
      await runPublish(invocation);
    } else if (invocation.command === "add") {
      await runAdd(invocation);
    } else {
      await runDelete(invocation);
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}
if (import.meta.main)
  process.exitCode = await runCli(Bun.argv.slice(2));
export {
  runCli,
  parseCliInvocation
};

//# debugId=6C6E41131663D8CF64756E2164756E21
