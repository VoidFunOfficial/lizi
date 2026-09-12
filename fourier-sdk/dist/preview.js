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
export {
  startPreviewServer,
  definePreview,
  defaultPreviewSourcePath
};

//# debugId=216F1817322A2DAF64756E2164756E21
