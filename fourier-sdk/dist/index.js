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

// src/project.ts
import { Fragment, isValidElement } from "react";
var FOURIER_PROJECT_NODE = Symbol.for("@fourier-video/sdk/project-node");
var FOURIER_PROJECT_DEFINITION = Symbol.for("@fourier-video/sdk/project-definition");
function projectNode(tag) {
  const component = () => null;
  Object.defineProperty(component, FOURIER_PROJECT_NODE, { value: tag });
  Object.defineProperty(component, "displayName", { value: `FourierProject.${tag}` });
  return component;
}
var Project = projectNode("project");
var Canvas = projectNode("canvas");
var Timeline = projectNode("timeline");
var Group = projectNode("group");
var Video = projectNode("video");
var Audio = projectNode("audio");
var Image = projectNode("image");
var Text = projectNode("text");
var Subtitle = projectNode("subtitle");
var ReactLayer = projectNode("react");
var Scene = projectNode("scene");
var Template = projectNode("template");
var Motion = projectNode("motion");
var Shader = projectNode("shader");
var Transform = projectNode("transform");
function nodeTag(type) {
  if (typeof type !== "function" && typeof type !== "object" || type === null) {
    return;
  }
  const tag = type[FOURIER_PROJECT_NODE];
  return typeof tag === "string" ? tag : undefined;
}
function readProjectElement(value) {
  if (!isValidElement(value))
    return;
  const tag = nodeTag(value.type);
  return tag === undefined ? undefined : { tag, props: value.props };
}
function definitionBase(kind) {
  return {
    package: "@fourier-video/sdk",
    version: 1,
    kind,
    [FOURIER_PROJECT_DEFINITION]: true
  };
}
function assertProjectRoot(declaration) {
  if (readProjectElement(declaration)?.tag !== "project") {
    sdkFail("INVALID_PROJECT_DEFINITION", "defineProject/defineTemplate.render \u5FC5\u987B\u8FD4\u56DE <Project> \u6839\u8282\u70B9");
  }
}
function defineProject(declaration) {
  assertProjectRoot(declaration);
  return Object.freeze({ ...definitionBase("project"), declaration });
}
function defineTemplate(definition) {
  if (typeof definition?.render !== "function") {
    sdkFail("INVALID_TEMPLATE_DEFINITION", "defineTemplate.render \u5FC5\u987B\u662F\u51FD\u6570");
  }
  const schema = defineSchema(definition.schema);
  for (const [name, field2] of Object.entries(schema)) {
    if (field2.kind === "node") {
      sdkFail("INVALID_TEMPLATE_DEFINITION", `Template schema.${name} \u4E0D\u652F\u6301 node \u5B57\u6BB5`);
    }
  }
  const render = (props) => {
    const declaration = definition.render(props);
    assertProjectRoot(declaration);
    return declaration;
  };
  return Object.freeze({ ...definitionBase("template"), schema, render });
}
function readProjectDefinition(value) {
  if (typeof value !== "object" || value === null)
    return;
  const candidate = value;
  return candidate[FOURIER_PROJECT_DEFINITION] === true && candidate.package === "@fourier-video/sdk" && candidate.version === 1 && (candidate.kind === "project" || candidate.kind === "template") ? candidate : undefined;
}
function timeInput(value) {
  if (typeof value === "string") {
    return /^(?:\d+(?:\.\d+)?(?:ms|s|f))+$/.test(value);
  }
  return typeof value === "object" && value !== null && typeof value.source === "string" && Number.isInteger(value.frames) && Number.isFinite(value.seconds);
}
function validateTemplateValue(name, field2, value) {
  if (field2.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value) || field2.integer === true && !Number.isInteger(value) || field2.min !== undefined && value < field2.min || field2.max !== undefined && value > field2.max) {
      sdkFail("INVALID_TEMPLATE_PROP", `${name} \u4E0D\u7B26\u5408 number schema`, { field: name });
    }
    return;
  }
  if (field2.kind === "boolean") {
    if (typeof value !== "boolean") {
      sdkFail("INVALID_TEMPLATE_PROP", `${name} \u5FC5\u987B\u662F boolean`, { field: name });
    }
    return;
  }
  if (field2.kind === "time") {
    if (!timeInput(value)) {
      sdkFail("INVALID_TEMPLATE_PROP", `${name} \u5FC5\u987B\u662F\u6709\u6548\u65F6\u95F4`, { field: name });
    }
    return;
  }
  if (typeof value !== "string") {
    sdkFail("INVALID_TEMPLATE_PROP", `${name} \u5FC5\u987B\u662F string`, { field: name });
  }
  if (field2.kind === "enum" && !field2.values?.includes(value)) {
    sdkFail("INVALID_TEMPLATE_PROP", `${name} \u4E0D\u5728 schema \u679A\u4E3E\u4E2D`, { field: name });
  }
  if (field2.kind === "color" && !(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) || /^[a-zA-Z]+$/.test(value))) {
    sdkFail("INVALID_TEMPLATE_PROP", `${name} \u4E0D\u662F\u53D7\u652F\u6301\u7684\u989C\u8272`, { field: name });
  }
  if (field2.minLength !== undefined && value.length < field2.minLength || field2.maxLength !== undefined && value.length > field2.maxLength) {
    sdkFail("INVALID_TEMPLATE_PROP", `${name} \u957F\u5EA6\u8D85\u51FA schema \u8303\u56F4`, { field: name });
  }
}
function bindTemplateProps(definition, input) {
  const unknown = Object.keys(input).filter((name) => !Object.hasOwn(definition.schema, name));
  if (unknown.length > 0) {
    sdkFail("UNKNOWN_TEMPLATE_PROP", `\u5B58\u5728 schema \u672A\u58F0\u660E\u53C2\u6570: ${unknown.join(", ")}`);
  }
  const props = {};
  const sources = {};
  for (const [name, field2] of Object.entries(definition.schema)) {
    const explicit = Object.hasOwn(input, name);
    if (!explicit && !field2.hasDefault) {
      sdkFail("MISSING_TEMPLATE_PROP", `\u7F3A\u5C11\u5FC5\u586B Template \u53C2\u6570 ${name}`, { field: name });
    }
    const value = explicit ? input[name] : field2.defaultValue;
    validateTemplateValue(name, field2, value);
    props[name] = value;
    sources[name] = explicit ? "explicit" : "default";
  }
  return { props: Object.freeze(props), sources: Object.freeze(sources) };
}
function jsonValue(value, path) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isFinite(value))
    return value;
  if (Array.isArray(value))
    return Object.freeze(value.map((entry, index) => jsonValue(entry, `${path}[${index}]`)));
  if (typeof value === "object" && value !== null) {
    const result = {};
    for (const [key, entry] of Object.entries(value))
      result[key] = jsonValue(entry, `${path}.${key}`);
    return Object.freeze(result);
  }
  sdkFail("INVALID_PROJECT_DEFINITION", `${path} \u5FC5\u987B\u662F JSON-safe \u6570\u636E`);
}
function collectProjectChildren(value, path) {
  const result = [];
  function append(child, containerDepth) {
    if (containerDepth > 64) {
      sdkFail("INVALID_PROJECT_DEFINITION", `${path} \u7684 JSX children \u5BB9\u5668\u6DF1\u5EA6\u8D85\u8FC7 64`);
    }
    if (child === null || child === undefined || typeof child === "boolean")
      return;
    if (Array.isArray(child)) {
      for (const nested of child)
        append(nested, containerDepth + 1);
      return;
    }
    if (isValidElement(child) && child.type === Fragment) {
      append(child.props.children, containerDepth + 1);
      return;
    }
    result.push(child);
  }
  append(value, 0);
  return result;
}
function materializeProjectElement(value, path, depth) {
  if (depth > 64)
    sdkFail("INVALID_PROJECT_DEFINITION", "Project JSX \u6DF1\u5EA6\u8D85\u8FC7 64");
  const element = readProjectElement(value);
  if (element === undefined)
    sdkFail("INVALID_PROJECT_DEFINITION", `${path} \u4E0D\u662F Fourier Project JSX \u8282\u70B9`);
  const { children, ...rawProps } = element.props;
  const childElements = collectProjectChildren(children, `${path}.children`);
  return Object.freeze({
    revision: 1,
    tag: element.tag,
    props: jsonValue(rawProps, `${path}.props`),
    children: Object.freeze(childElements.map((child, index) => materializeProjectElement(child, `${path}.children[${index}]`, depth + 1)))
  });
}
function serializeProjectDefinition(definition, bindings = {}) {
  const recognized = readProjectDefinition(definition);
  if (recognized === undefined)
    sdkFail("INVALID_PROJECT_DEFINITION", "default export \u5FC5\u987B\u7531 defineProject/defineTemplate \u521B\u5EFA");
  const bound = recognized.kind === "template" ? bindTemplateProps(recognized, bindings) : (() => {
    if (Object.keys(bindings).length > 0)
      sdkFail("UNKNOWN_TEMPLATE_PROP", "Project \u4E0D\u80FD\u63A5\u6536 Template bindings");
    return { props: Object.freeze({}), sources: Object.freeze({}) };
  })();
  const declaration = recognized.kind === "template" ? recognized.render(bound.props) : recognized.declaration;
  const parameters = recognized.kind === "template" ? jsonValue(recognized.schema, "template.schema") : Object.freeze({});
  return Object.freeze({
    revision: 1,
    kind: recognized.kind,
    root: materializeProjectElement(declaration, "project", 0),
    parameters,
    bindings: bound.props,
    bindingSources: bound.sources
  });
}

// src/react-runtime.ts
import { default as default2 } from "react";
import {
  Children,
  Component,
  Fragment as Fragment2,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement as isValidElement2,
  lazy,
  memo,
  startTransition,
  use,
  useActionState,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version
} from "react";

// src/universe.ts
import React2, {
  createContext as createContext3,
  useContext as useContext3,
  useLayoutEffect as useLayoutEffect3,
  useMemo as useMemo3,
  useRef as useRef3
} from "react";

// src/runtime.ts
import React, {
  createContext as createContext2,
  useContext as useContext2,
  useLayoutEffect as useLayoutEffect2,
  useMemo as useMemo2,
  useRef as useRef2
} from "react";
function projectedSurface(input) {
  if (typeof input?.videoId !== "string" || input.videoId.length === 0) {
    throw new SdkError("VIDEO_SURFACE_INVALID", "video surface \u5FC5\u987B\u6709\u975E\u7A7A videoId");
  }
  if (!Array.isArray(input.corners) || input.corners.length !== 4 || input.corners.some((point) => typeof point !== "object" || point === null || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new SdkError("VIDEO_SURFACE_INVALID", `video surface "${input.videoId}" \u5FC5\u987B\u63D0\u4F9B\u56DB\u4E2A\u6709\u9650\u6295\u5F71\u5750\u6807`);
  }
  if (!Number.isFinite(input.cornerRadiusRatio) || input.cornerRadiusRatio < 0 || input.cornerRadiusRatio > 0.5) {
    throw new SdkError("VIDEO_SURFACE_INVALID", `video surface "${input.videoId}" \u7684 cornerRadiusRatio \u5FC5\u987B\u5728 0\u20140.5`);
  }
  const [topLeft, topRight, bottomLeft, bottomRight] = input.corners;
  const polygon = [topLeft, topRight, bottomRight, bottomLeft];
  const crosses = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const after = polygon[(index + 2) % polygon.length];
    return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x);
  });
  const epsilon = 0.000001;
  if (crosses.some((value) => Math.abs(value) <= epsilon) || !(crosses.every((value) => value > 0) || crosses.every((value) => value < 0))) {
    throw new SdkError("VIDEO_SURFACE_INVALID", `video surface "${input.videoId}" \u5FC5\u987B\u662F\u975E\u9000\u5316\u51F8\u56DB\u8FB9\u5F62`);
  }
  return Object.freeze({
    videoId: input.videoId,
    cornerRadiusRatio: input.cornerRadiusRatio,
    corners: Object.freeze(input.corners.map((point) => Object.freeze({ x: point.x, y: point.y })))
  });
}
function finite(value, field2) {
  if (!Number.isFinite(value)) {
    throw new SdkError("INVALID_TIMELINE_ANIMATION_OPTIONS", `FourierTimeline ${field2} \u5FC5\u987B\u662F\u6709\u9650\u6570`, { field: field2, value });
  }
  return value;
}
function finiteNonNegative(value, field2) {
  const result = finite(value, field2);
  if (result < 0) {
    throw new SdkError("INVALID_TIMELINE_ANIMATION_OPTIONS", `FourierTimeline ${field2} \u5FC5\u987B\u662F\u975E\u8D1F\u6570`, { field: field2, value });
  }
  return result;
}
var animationOptionKeys = new Set([
  "duration",
  "delay",
  "iterations",
  "easing",
  "direction",
  "fill"
]);
function validateOptions(options) {
  const unsupported = Object.keys(options).filter((key) => !animationOptionKeys.has(key));
  if (unsupported.length > 0) {
    throw new SdkError("UNSUPPORTED_TIMELINE_ANIMATION_OPTIONS", `FourierTimeline \u4E0D\u652F\u6301\u9009\u9879: ${unsupported.join(", ")}`, { fields: unsupported });
  }
}
function validateKeyframeComposite(keyframes) {
  const values = Array.isArray(keyframes) ? keyframes.flatMap((frame) => frame.composite === undefined ? [] : [frame.composite]) : keyframes.composite === undefined ? [] : Array.isArray(keyframes.composite) ? keyframes.composite : [keyframes.composite];
  if (values.some((value) => value !== "replace" && value !== "auto")) {
    throw new SdkError("UNSUPPORTED_TIMELINE_COMPOSITE", "FourierTimeline \u4EC5\u652F\u6301 replace composite");
  }
}
function validateKeyframeOffsets(keyframes) {
  const rawOffsets = Array.isArray(keyframes) ? keyframes.map((frame) => frame.offset) : Array.isArray(keyframes.offset) ? keyframes.offset : [keyframes.offset];
  let previous = 0;
  for (const [index, value] of rawOffsets.entries()) {
    if (value === undefined || value === null)
      continue;
    if (!Number.isFinite(value) || value < 0 || value > 1 || value < previous) {
      throw new SdkError("INVALID_TIMELINE_KEYFRAME_OFFSETS", "FourierTimeline keyframe offset \u5FC5\u987B\u4F4D\u4E8E 0\u20141 \u4E14\u5355\u8C03\u4E0D\u9012\u51CF", { index, previous, value });
    }
    previous = value;
  }
}
function createFourierRuntimeController(stableContext, hostDurationMilliseconds) {
  finiteNonNegative(hostDurationMilliseconds, "hostDurationMilliseconds");
  const fps = stableContext.fps ?? 60;
  if (!Number.isSafeInteger(fps) || fps <= 0) {
    throw new SdkError("INVALID_RUNTIME_CONTEXT", "Fourier runtime fps \u5FC5\u987B\u662F\u6B63\u6574\u6570", {
      fps
    });
  }
  const durationInFrames = stableContext.durationInFrames ?? Math.max(1, Math.round(hostDurationMilliseconds / 1000 * fps));
  if (!Number.isSafeInteger(durationInFrames) || durationInFrames <= 0) {
    throw new SdkError("INVALID_RUNTIME_CONTEXT", "Fourier runtime durationInFrames \u5FC5\u987B\u662F\u6B63\u6574\u6570", { durationInFrames });
  }
  const resolvedStableContext = Object.freeze({
    width: stableContext.width,
    height: stableContext.height,
    seed: stableContext.seed,
    fps,
    durationInFrames,
    durationMilliseconds: hostDurationMilliseconds
  });
  let lifecycle;
  let lifecycleRegistrationError;
  const animations = [];
  const renderDrivers = [];
  let renderDriversPreparing = false;
  let renderDriversPrepared = false;
  let renderedTimeMilliseconds = null;
  let projectedVideoSurfaces = Object.freeze([]);
  const bindings = Object.freeze({
    stableContext: resolvedStableContext,
    hostDurationMilliseconds,
    registerLifecycle(token, read) {
      if (lifecycle !== undefined && lifecycle.token !== token) {
        lifecycleRegistrationError = new SdkError("DUPLICATE_FOURIER_LIFECYCLE", "\u540C\u4E00 artifact \u53EA\u80FD\u6CE8\u518C\u4E00\u4E2A Fourier lifecycle");
        throw lifecycleRegistrationError;
      }
      lifecycle = { token, read };
      return () => {
        if (lifecycle?.token === token)
          lifecycle = undefined;
      };
    },
    registerAnimation(animation) {
      if (animations.includes(animation)) {
        throw new SdkError("DUPLICATE_FOURIER_ANIMATION", "\u540C\u4E00 Animation \u4E0D\u80FD\u91CD\u590D\u6CE8\u518C");
      }
      animations.push(animation);
    },
    registerRenderDriver(token, driver) {
      if (renderDriversPreparing || renderDriversPrepared) {
        throw new SdkError("FOURIER_RENDER_DRIVER_LATE_REGISTRATION", "Fourier render driver \u5FC5\u987B\u5728 runtime \u521D\u59CB\u5316\u9636\u6BB5\u6CE8\u518C");
      }
      if (renderDrivers.some((slot2) => slot2.token === token || slot2.driver === driver)) {
        throw new SdkError("DUPLICATE_FOURIER_RENDER_DRIVER", "\u540C\u4E00 Fourier render driver \u4E0D\u80FD\u91CD\u590D\u6CE8\u518C");
      }
      const slot = { token, driver };
      renderDrivers.push(slot);
      return () => {
        const index = renderDrivers.indexOf(slot);
        if (index !== -1)
          renderDrivers.splice(index, 1);
        driver.dispose?.();
      };
    }
  });
  return Object.freeze({
    bindings,
    getLifecycle: () => {
      if (lifecycleRegistrationError !== undefined)
        throw lifecycleRegistrationError;
      return lifecycle?.read();
    },
    getAnimations: () => Object.freeze([...animations]),
    prepareRenderDrivers: async () => {
      if (renderDriversPrepared)
        return;
      if (renderDriversPreparing) {
        throw new SdkError("FOURIER_RENDER_DRIVER_PREPARE_IN_PROGRESS", "Fourier render driver \u6B63\u5728\u521D\u59CB\u5316");
      }
      renderDriversPreparing = true;
      try {
        await Promise.all(renderDrivers.map(({ driver }) => driver.ready()));
        renderDriversPrepared = true;
      } finally {
        renderDriversPreparing = false;
      }
    },
    renderFrame: (timeMilliseconds) => {
      const sampleTime = finiteNonNegative(timeMilliseconds, "timeMilliseconds");
      if (!renderDriversPrepared) {
        throw new SdkError("FOURIER_RENDER_DRIVER_NOT_READY", "Fourier render driver \u5FC5\u987B\u5148\u5B8C\u6210 prepareRenderDrivers()");
      }
      const frame = Object.freeze({
        timeMilliseconds: sampleTime,
        timeSeconds: sampleTime / 1000,
        progress: hostDurationMilliseconds === 0 ? 0 : Math.min(1, Math.max(0, sampleTime / hostDurationMilliseconds)),
        durationMilliseconds: hostDurationMilliseconds
      });
      const surfaces = [];
      for (const { driver } of renderDrivers) {
        const result = driver.render(frame);
        if (result !== null && (typeof result === "object" || typeof result === "function") && typeof result.then === "function") {
          throw new SdkError("FOURIER_RENDER_FRAME_ASYNC", "Fourier render driver.render() \u5FC5\u987B\u540C\u6B65\u8FD4\u56DE");
        }
        if (result !== undefined) {
          for (const surface of result.videoSurfaces ?? []) {
            const normalized = projectedSurface(surface);
            if (surfaces.some((entry) => entry.videoId === normalized.videoId)) {
              throw new SdkError("VIDEO_SURFACE_MULTIPLE", `video "${normalized.videoId}" \u53EA\u80FD\u7ED1\u5B9A\u4E00\u4E2A surface`);
            }
            surfaces.push(normalized);
          }
        }
      }
      renderedTimeMilliseconds = sampleTime;
      projectedVideoSurfaces = Object.freeze(surfaces);
      return Object.freeze({ videoSurfaces: projectedVideoSurfaces });
    },
    getRenderState: () => Object.freeze({
      driverCount: renderDrivers.length,
      timeMilliseconds: renderedTimeMilliseconds,
      videoSurfaces: projectedVideoSurfaces
    })
  });
}
var RuntimeContext = createContext2(undefined);
function FourierRuntimeProvider(props) {
  return React.createElement(RuntimeContext.Provider, {
    value: props.bindings,
    children: props.children
  });
}
function useRuntime(operation) {
  const runtime = useContext2(RuntimeContext);
  if (runtime === undefined) {
    throw new SdkError("FOURIER_RUNTIME_REQUIRED", `${operation} \u53EA\u80FD\u5728 Fourier DOM timeline runtime \u5185\u4F7F\u7528`);
  }
  return runtime;
}
function useFourierLifecycle(callbacks) {
  const runtime = useRuntime("useFourierLifecycle()");
  const callbacksRef = useRef2(callbacks);
  callbacksRef.current = callbacks;
  const tokenRef = useRef2(undefined);
  if (tokenRef.current === undefined)
    tokenRef.current = Symbol("fourier-lifecycle");
  useLayoutEffect2(() => runtime.registerLifecycle(tokenRef.current, () => callbacksRef.current), [runtime]);
}
function useFourierContext() {
  return useRuntime("useFourierContext()").stableContext;
}
function useFourierTimeline() {
  const runtime = useRuntime("useFourierTimeline()");
  return useMemo2(() => Object.freeze({
    animate(target, keyframes, options = {}) {
      if (!(target instanceof Element)) {
        throw new SdkError("INVALID_TIMELINE_ANIMATION_TARGET", "FourierTimeline.animate() target \u5FC5\u987B\u662F Element");
      }
      validateOptions(options);
      validateKeyframeComposite(keyframes);
      validateKeyframeOffsets(keyframes);
      const animation = target.animate(keyframes, {
        duration: finiteNonNegative(options.duration ?? runtime.hostDurationMilliseconds, "duration"),
        delay: finite(options.delay ?? 0, "delay"),
        iterations: finiteNonNegative(options.iterations ?? 1, "iterations"),
        easing: options.easing ?? "linear",
        direction: options.direction ?? "normal",
        fill: options.fill ?? "both",
        composite: "replace"
      });
      animation.playbackRate = 1;
      animation.pause();
      runtime.registerAnimation(animation);
    }
  }), [runtime]);
}
function useFourierRenderDriver(driver) {
  const runtime = useRuntime("useFourierRenderDriver()");
  const tokenRef = useRef2(undefined);
  if (tokenRef.current === undefined)
    tokenRef.current = Symbol("fourier-render-driver");
  useLayoutEffect2(() => runtime.registerRenderDriver(tokenRef.current, driver), [runtime, driver]);
}
function hashSeed(seed) {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new SdkError("INVALID_PRNG_SEED", "createFourierPrng() seed \u5FC5\u987B\u662F\u6709\u9650\u6570\u6216\u5B57\u7B26\u4E32");
    }
    return seed >>> 0;
  }
  let hash = 2166136261;
  for (let index = 0;index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function createFourierPrng(seed) {
  let state = hashSeed(seed);
  return () => {
    state = state + 1831565813 >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

// src/universe-core.ts
var CAMERA_DEFINITION = Symbol("fourier-camera-definition");
var CAMERA_PROGRAM_DEFINITION = Symbol("fourier-camera-program-definition");
var ASPECT_EPSILON = 0.000001;
var GEOMETRY_EPSILON = 0.000000001;
function fail(code, message, details) {
  throw new SdkError(code, message, details);
}
function finite2(value, field2) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail("INVALID_CAMERA", `${field2} \u5FC5\u987B\u662F\u6709\u9650\u6570`, { field: field2, value });
  }
  return value;
}
function positive(value, field2) {
  const result = finite2(value, field2);
  if (result <= 0)
    fail("INVALID_CAMERA", `${field2} \u5FC5\u987B\u5927\u4E8E 0`, { field: field2, value });
  return result;
}
function point(value, field2) {
  return Object.freeze({
    x: finite2(value?.x, `${field2}.x`),
    y: finite2(value?.y, `${field2}.y`)
  });
}
function timeExpression(value, field2) {
  if (typeof value === "string") {
    if (!/^(?:\d+(?:\.\d+)?(?:ms|s|f))+$/.test(value)) {
      fail("INVALID_CAMERA_TIME", `${field2} \u4E0D\u662F\u6709\u6548\u65F6\u95F4: ${value}`, { field: field2, value });
    }
    return value;
  }
  if (typeof value !== "object" || value === null || typeof value.source !== "string" || !Number.isInteger(value.frames) || value.frames < 0 || !Number.isFinite(value.seconds) || value.seconds < 0) {
    fail("INVALID_CAMERA_TIME", `${field2} \u5FC5\u987B\u662F TimeExpression`, { field: field2 });
  }
  return Object.freeze({ ...value });
}
function cameraEase(value, field2) {
  const result = value ?? "linear";
  if (typeof result === "string") {
    if (!["linear", "ease", "ease-in", "ease-out", "ease-in-out"].includes(result)) {
      fail("INVALID_CAMERA", `${field2} \u4E0D\u662F\u652F\u6301\u7684 Camera easing`, { field: field2, value: result });
    }
    return result;
  }
  if (result.length !== 4 || result.some((entry) => !Number.isFinite(entry)) || result[0] < 0 || result[0] > 1 || result[2] < 0 || result[2] > 1) {
    fail("INVALID_CAMERA", `${field2} \u5FC5\u987B\u662F\u6709\u6548 cubic-bezier`, { field: field2 });
  }
  return Object.freeze([...result]);
}
function cameraPath(value, field2) {
  if (value === undefined || value.kind === "linear") {
    return Object.freeze({ kind: "linear" });
  }
  if (value.kind === "bezier") {
    return Object.freeze({
      kind: "bezier",
      control1: point(value.control1, `${field2}.control1`),
      control2: point(value.control2, `${field2}.control2`)
    });
  }
  if (value.kind === "arc") {
    const direction = value.direction ?? "shortest";
    if (!["shortest", "clockwise", "counterclockwise"].includes(direction)) {
      fail("INVALID_CAMERA", `${field2}.direction \u65E0\u6548`, { field: field2, direction });
    }
    const turns = value.turns ?? 0;
    if (!Number.isSafeInteger(turns) || turns < 0) {
      fail("INVALID_CAMERA", `${field2}.turns \u5FC5\u987B\u662F\u975E\u8D1F\u6574\u6570`, { field: field2, turns });
    }
    return Object.freeze({
      kind: "arc",
      center: point(value.center, `${field2}.center`),
      direction,
      turns
    });
  }
  if (value.kind === "curve") {
    if (!Array.isArray(value.points) || value.points.length === 0) {
      fail("INVALID_CAMERA", `${field2}.points \u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u8DEF\u5F84\u70B9`, { field: field2 });
    }
    return Object.freeze({
      kind: "curve",
      points: Object.freeze(value.points.map((entry, index) => point(entry, `${field2}.points[${index}]`)))
    });
  }
  if (value.kind === "custom") {
    if (typeof value.sample !== "function") {
      fail("INVALID_CAMERA", `${field2}.sample \u5FC5\u987B\u662F\u540C\u6B65\u51FD\u6570`, { field: field2 });
    }
    return Object.freeze({ kind: "custom", sample: value.sample });
  }
  fail("INVALID_CAMERA", `${field2}.kind \u65E0\u6548`, { field: field2 });
}
function padding(value, field2) {
  if (value === undefined)
    return;
  if (typeof value === "number") {
    const result2 = finite2(value, field2);
    if (result2 < 0)
      fail("INVALID_CAMERA", `${field2} \u4E0D\u80FD\u4E3A\u8D1F\u6570`, { field: field2, value });
    return result2;
  }
  const result = {
    top: finite2(value?.top, `${field2}.top`),
    right: finite2(value?.right, `${field2}.right`),
    bottom: finite2(value?.bottom, `${field2}.bottom`),
    left: finite2(value?.left, `${field2}.left`)
  };
  if (Object.values(result).some((entry) => entry < 0)) {
    fail("INVALID_CAMERA", `${field2} \u4E0D\u80FD\u5305\u542B\u8D1F\u6570`, { field: field2 });
  }
  return Object.freeze(result);
}
function target(value, field2) {
  if (typeof value !== "object" || value === null) {
    fail("INVALID_CAMERA", `${field2} \u5FC5\u987B\u662F Camera target`, { field: field2 });
  }
  if (value.kind === "pose") {
    const fields = ["x", "y", "zoom", "rotation", "width", "height"];
    if (fields.every((name) => value[name] === undefined)) {
      fail("INVALID_CAMERA", `${field2} pose \u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u5C5E\u6027`, { field: field2 });
    }
    const resolved = { kind: "pose" };
    for (const name of fields) {
      if (value[name] === undefined)
        continue;
      resolved[name] = name === "zoom" || name === "width" || name === "height" ? positive(value[name], `${field2}.${name}`) : finite2(value[name], `${field2}.${name}`);
    }
    return Object.freeze(resolved);
  }
  if (value.kind === "fit") {
    if (typeof value.target !== "string" || value.target.length === 0) {
      fail("INVALID_CAMERA", `${field2}.target \u5FC5\u987B\u662F\u975E\u7A7A World id`, { field: field2 });
    }
    if (!["contain", "cover", "width", "height"].includes(value.fit)) {
      fail("INVALID_CAMERA", `${field2}.fit \u65E0\u6548`, { field: field2, value: value.fit });
    }
    const resolvedPadding = padding(value.padding, `${field2}.padding`);
    return Object.freeze({
      kind: "fit",
      target: value.target,
      fit: value.fit,
      ...resolvedPadding === undefined ? {} : { padding: resolvedPadding }
    });
  }
  fail("INVALID_CAMERA", `${field2}.kind \u5FC5\u987B\u662F pose \u6216 fit`, { field: field2 });
}
function defineCamera(input) {
  if (typeof input !== "object" || input === null) {
    fail("INVALID_CAMERA", "defineCamera() \u9700\u8981\u914D\u7F6E\u5BF9\u8C61");
  }
  const initial = Object.freeze({
    x: finite2(input.initial?.x ?? 0, "camera.initial.x"),
    y: finite2(input.initial?.y ?? 0, "camera.initial.y"),
    zoom: positive(input.initial?.zoom ?? 1, "camera.initial.zoom"),
    rotation: finite2(input.initial?.rotation ?? 0, "camera.initial.rotation")
  });
  const moves = Object.freeze((input.moves ?? []).map((move, index) => {
    if (typeof move !== "object" || move === null) {
      fail("INVALID_CAMERA", `camera.moves[${index}] \u5FC5\u987B\u662F\u5BF9\u8C61`);
    }
    return Object.freeze({
      at: timeExpression(move.at, `camera.moves[${index}].at`),
      duration: timeExpression(move.duration, `camera.moves[${index}].duration`),
      to: target(move.to, `camera.moves[${index}].to`),
      path: cameraPath(move.path, `camera.moves[${index}].path`),
      ease: cameraEase(move.ease, `camera.moves[${index}].ease`)
    });
  }));
  return Object.freeze({
    width: positive(input.width, "camera.width"),
    height: positive(input.height, "camera.height"),
    initial,
    moves,
    [CAMERA_DEFINITION]: true
  });
}
function isCameraDefinition(value) {
  return typeof value === "object" && value !== null && value[CAMERA_DEFINITION] === true;
}
function defineCameraProgram(input) {
  if (typeof input !== "object" || input === null || typeof input.cameras !== "object" || input.cameras === null) {
    fail("INVALID_CAMERA_PROGRAM", "defineCameraProgram() \u9700\u8981 cameras \u5BF9\u8C61");
  }
  const entries = Object.entries(input.cameras);
  if (entries.length === 0) {
    fail("INVALID_CAMERA_PROGRAM", "Camera Program \u81F3\u5C11\u9700\u8981\u4E00\u4E2A Camera");
  }
  const cameras = {};
  for (const [id, camera] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) {
      fail("INVALID_CAMERA_PROGRAM", `Camera id "${id}" \u65E0\u6548`, { id });
    }
    if (!isCameraDefinition(camera)) {
      fail("INVALID_CAMERA_PROGRAM", `Camera "${id}" \u5FC5\u987B\u7531 defineCamera() \u521B\u5EFA`, { id });
    }
    cameras[id] = camera;
  }
  if (typeof input.initialCamera !== "string" || cameras[input.initialCamera] === undefined) {
    fail("INVALID_CAMERA_PROGRAM", "initialCamera \u5FC5\u987B\u5F15\u7528\u5DF2\u58F0\u660E Camera", {
      initialCamera: input.initialCamera
    });
  }
  const cuts = Object.freeze((input.cuts ?? []).map((cut, index) => {
    if (typeof cut !== "object" || cut === null) {
      fail("INVALID_CAMERA_PROGRAM", `camera.cuts[${index}] \u5FC5\u987B\u662F\u5BF9\u8C61`);
    }
    if (typeof cut.to !== "string" || cameras[cut.to] === undefined) {
      fail("INVALID_CAMERA_PROGRAM", `camera.cuts[${index}].to \u5FC5\u987B\u5F15\u7528\u5DF2\u58F0\u660E Camera`, {
        index,
        to: cut.to
      });
    }
    return Object.freeze({
      at: timeExpression(cut.at, `camera.cuts[${index}].at`),
      to: cut.to
    });
  }));
  return Object.freeze({
    cameras: Object.freeze(cameras),
    initialCamera: input.initialCamera,
    cuts,
    [CAMERA_PROGRAM_DEFINITION]: true
  });
}
function isCameraProgramDefinition(value) {
  return typeof value === "object" && value !== null && value[CAMERA_PROGRAM_DEFINITION] === true;
}
function isCameraSource(value) {
  return isCameraDefinition(value) || isCameraProgramDefinition(value);
}
function initialCamera(camera) {
  return isCameraDefinition(camera) ? camera : camera.cameras[camera.initialCamera];
}
function resolveTimeFrames(value, fps, field2) {
  positive(fps, "composition.fps");
  if (typeof value !== "string")
    return value.frames;
  const pattern = /(\d+(?:\.\d+)?)(ms|s|f)/g;
  let frames = 0;
  let match;
  while ((match = pattern.exec(value)) !== null) {
    const amount = Number(match[1]);
    frames += match[2] === "f" ? amount : match[2] === "s" ? amount * fps : amount * fps / 1000;
  }
  const rounded = Math.round(frames);
  if (!Number.isSafeInteger(rounded) || rounded < 0) {
    fail("INVALID_CAMERA_TIME", `${field2} \u8D85\u51FA\u53EF\u7528\u5E27\u8303\u56F4`, { field: field2, value });
  }
  return rounded;
}
function aspectMatches(width, height, viewportWidth, viewportHeight) {
  return Math.abs(width / height - viewportWidth / viewportHeight) <= ASPECT_EPSILON;
}
function assertCameraAspect(pose, viewportWidth, viewportHeight) {
  if (!aspectMatches(pose.width, pose.height, viewportWidth, viewportHeight)) {
    fail("CAMERA_ASPECT_MISMATCH", `Camera ${pose.width}\xD7${pose.height} \u4E0E viewport ${viewportWidth}\xD7${viewportHeight} \u5BBD\u9AD8\u6BD4\u4E0D\u4E00\u81F4`, { camera: { width: pose.width, height: pose.height }, viewport: { width: viewportWidth, height: viewportHeight } });
  }
}
function worldPolygon(input) {
  const radians = input.rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const left = -input.anchor.x * input.width;
  const top = -input.anchor.y * input.height;
  const right = left + input.width;
  const bottom = top + input.height;
  const transform = (x, y) => {
    const scaledX = x * input.scale;
    const scaledY = y * input.scale;
    return Object.freeze({
      x: input.x + scaledX * cosine - scaledY * sine,
      y: input.y + scaledX * sine + scaledY * cosine
    });
  };
  return Object.freeze([
    transform(left, top),
    transform(right, top),
    transform(right, bottom),
    transform(left, bottom)
  ]);
}
function rotate(input, degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: input.x * cosine - input.y * sine,
    y: input.x * sine + input.y * cosine
  };
}
function normalizedPadding(value) {
  if (value === undefined)
    return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof value === "number")
    return { top: value, right: value, bottom: value, left: value };
  return value;
}
function fitPose(start, target2, bounds) {
  const oriented = bounds.polygon.map((entry) => rotate(entry, -start.rotation));
  const xs = oriented.map((entry) => entry.x);
  const ys = oriented.map((entry) => entry.y);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  const targetWidth = maximumX - minimumX;
  const targetHeight = maximumY - minimumY;
  const insets = normalizedPadding(target2.padding);
  const availableWidth = start.width - insets.left - insets.right;
  const availableHeight = start.height - insets.top - insets.bottom;
  if (availableWidth <= 0 || availableHeight <= 0) {
    fail("INVALID_CAMERA", "Camera Fit padding \u5FC5\u987B\u5C0F\u4E8E Camera \u5C3A\u5BF8", {
      target: target2.target,
      padding: insets
    });
  }
  const widthZoom = availableWidth / targetWidth;
  const heightZoom = availableHeight / targetHeight;
  const zoom = target2.fit === "contain" ? Math.min(widthZoom, heightZoom) : target2.fit === "cover" ? Math.max(widthZoom, heightZoom) : target2.fit === "width" ? widthZoom : heightZoom;
  const targetCenter = {
    x: (minimumX + maximumX) / 2,
    y: (minimumY + maximumY) / 2
  };
  const desiredScreenCenter = {
    x: (insets.left - insets.right) / 2,
    y: (insets.top - insets.bottom) / 2
  };
  const orientedCamera = {
    x: targetCenter.x - desiredScreenCenter.x / zoom,
    y: targetCenter.y - desiredScreenCenter.y / zoom
  };
  const cameraPosition = rotate(orientedCamera, start.rotation);
  return Object.freeze({ ...start, x: cameraPosition.x, y: cameraPosition.y, zoom });
}
function resolveTarget(start, value, worlds) {
  if (value.kind === "pose") {
    return Object.freeze({
      x: value.x ?? start.x,
      y: value.y ?? start.y,
      zoom: value.zoom ?? start.zoom,
      rotation: value.rotation ?? start.rotation,
      width: value.width ?? start.width,
      height: value.height ?? start.height
    });
  }
  const bounds = worlds.get(value.target);
  if (bounds === undefined) {
    fail("CAMERA_TARGET_NOT_FOUND", `Camera Fit \u627E\u4E0D\u5230 World "${value.target}"`, { target: value.target });
  }
  return fitPose(start, value, bounds);
}
function cubicCoordinate(start, first, second, end, progress) {
  const inverse = 1 - progress;
  return inverse ** 3 * start + 3 * inverse ** 2 * progress * first + 3 * inverse * progress ** 2 * second + progress ** 3 * end;
}
function cubicBezier(progress, values) {
  const [x1, y1, x2, y2] = values;
  let parameter = progress;
  for (let iteration = 0;iteration < 8; iteration += 1) {
    const x = cubicCoordinate(0, x1, x2, 1, parameter) - progress;
    const derivative = 3 * (1 - parameter) ** 2 * x1 + 6 * (1 - parameter) * parameter * (x2 - x1) + 3 * parameter ** 2 * (1 - x2);
    if (Math.abs(derivative) < 0.0000001)
      break;
    parameter = Math.min(1, Math.max(0, parameter - x / derivative));
  }
  let low = 0;
  let high = 1;
  for (let iteration = 0;iteration < 16; iteration += 1) {
    const x = cubicCoordinate(0, x1, x2, 1, parameter);
    if (Math.abs(x - progress) < 0.0000001)
      break;
    if (x < progress)
      low = parameter;
    else
      high = parameter;
    parameter = (low + high) / 2;
  }
  return cubicCoordinate(0, y1, y2, 1, parameter);
}
function ease(progress, value) {
  const curves = {
    linear: [0, 0, 1, 1],
    ease: [0.25, 0.1, 0.25, 1],
    "ease-in": [0.42, 0, 1, 1],
    "ease-out": [0, 0, 0.58, 1],
    "ease-in-out": [0.42, 0, 0.58, 1]
  };
  return cubicBezier(progress, typeof value === "string" ? curves[value] : value);
}
function catmullRom(points, progress) {
  const segmentCount = points.length - 1;
  const position = Math.min(segmentCount - GEOMETRY_EPSILON, progress * segmentCount);
  const index = Math.max(0, Math.floor(position));
  const local = progress >= 1 ? 1 : position - index;
  const p1 = points[index];
  const p2 = points[Math.min(points.length - 1, index + 1)];
  const p0 = points[Math.max(0, index - 1)];
  const p3 = points[Math.min(points.length - 1, index + 2)];
  const coordinate = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * local + (2 * a - 5 * b + 4 * c - d) * local ** 2 + (-a + 3 * b - 3 * c + d) * local ** 3);
  return { x: coordinate(p0.x, p1.x, p2.x, p3.x), y: coordinate(p0.y, p1.y, p2.y, p3.y) };
}
function arcPoint(start, end, path, progress) {
  const startVector = { x: start.x - path.center.x, y: start.y - path.center.y };
  const endVector = { x: end.x - path.center.x, y: end.y - path.center.y };
  const startAngle = Math.atan2(startVector.y, startVector.x);
  const endAngle = Math.atan2(endVector.y, endVector.x);
  let delta = endAngle - startAngle;
  if (path.direction === "clockwise") {
    while (delta < 0)
      delta += Math.PI * 2;
    delta += (path.turns ?? 0) * Math.PI * 2;
  } else if (path.direction === "counterclockwise") {
    while (delta > 0)
      delta -= Math.PI * 2;
    delta -= (path.turns ?? 0) * Math.PI * 2;
  } else {
    while (delta > Math.PI)
      delta -= Math.PI * 2;
    while (delta < -Math.PI)
      delta += Math.PI * 2;
    delta += Math.sign(delta || 1) * (path.turns ?? 0) * Math.PI * 2;
  }
  const radius = Math.hypot(startVector.x, startVector.y) + (Math.hypot(endVector.x, endVector.y) - Math.hypot(startVector.x, startVector.y)) * progress;
  const angle = startAngle + delta * progress;
  return {
    x: path.center.x + Math.cos(angle) * radius,
    y: path.center.y + Math.sin(angle) * radius
  };
}
function pathPosition(start, end, path, progress) {
  if (path.kind === "linear") {
    return {
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress
    };
  }
  if (path.kind === "bezier") {
    return {
      x: cubicCoordinate(start.x, path.control1.x, path.control2.x, end.x, progress),
      y: cubicCoordinate(start.y, path.control1.y, path.control2.y, end.y, progress)
    };
  }
  if (path.kind === "arc")
    return arcPoint(start, end, path, progress);
  if (path.kind === "curve") {
    return catmullRom([{ x: start.x, y: start.y }, ...path.points, { x: end.x, y: end.y }], progress);
  }
  const context = Object.freeze({
    start: Object.freeze({ x: start.x, y: start.y }),
    end: Object.freeze({ x: end.x, y: end.y })
  });
  const first = point(path.sample(progress, context), "camera custom path result");
  const second = point(path.sample(progress, context), "camera custom path result");
  if (first.x !== second.x || first.y !== second.y) {
    fail("NON_DETERMINISTIC_CAMERA_PATH", "Camera custom path \u5BF9\u76F8\u540C\u8F93\u5165\u8FD4\u56DE\u4E86\u4E0D\u540C\u7ED3\u679C", {
      progress,
      first,
      second
    });
  }
  return first;
}
function interpolate(start, end, path, progress) {
  const lerp = (left, right) => left + (right - left) * progress;
  const position = pathPosition(start, end, path, progress);
  return Object.freeze({
    ...position,
    zoom: lerp(start.zoom, end.zoom),
    rotation: lerp(start.rotation, end.rotation),
    width: lerp(start.width, end.width),
    height: lerp(start.height, end.height)
  });
}
function cameraMatrix(pose, viewportWidth, viewportHeight) {
  const scale = viewportWidth / pose.width * pose.zoom;
  const radians = -pose.rotation * Math.PI / 180;
  const a = scale * Math.cos(radians);
  const b = scale * Math.sin(radians);
  const c = -scale * Math.sin(radians);
  const d = scale * Math.cos(radians);
  const e = viewportWidth / 2 - a * pose.x - c * pose.y;
  const f = viewportHeight / 2 - b * pose.x - d * pose.y;
  return `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
}
function resolveUniverseFrames(input) {
  const { camera, worlds, fps, durationInFrames, viewportWidth, viewportHeight } = input;
  if (!Number.isSafeInteger(durationInFrames) || durationInFrames <= 0) {
    fail("INVALID_CAMERA", "composition.durationInFrames \u5FC5\u987B\u662F\u6B63\u6574\u6570");
  }
  const initial = Object.freeze({ ...camera.initial, width: camera.width, height: camera.height });
  assertCameraAspect(initial, viewportWidth, viewportHeight);
  let previousEnd = 0;
  let cursor = initial;
  const moves = camera.moves.map((move, index) => {
    const startFrame = resolveTimeFrames(move.at, fps, `camera.moves[${index}].at`);
    const durationFrames = resolveTimeFrames(move.duration, fps, `camera.moves[${index}].duration`);
    if (durationFrames <= 0) {
      fail("INVALID_CAMERA_TIME", `camera.moves[${index}].duration \u5FC5\u987B\u81F3\u5C11\u4E3A 1 frame`, { index });
    }
    const endFrame = startFrame + durationFrames;
    if (startFrame < previousEnd) {
      fail("CAMERA_MOVE_OVERLAP", `camera.moves[${index}] \u4E0E\u524D\u4E00\u4E2A Move \u91CD\u53E0`, { index });
    }
    if (endFrame > durationInFrames) {
      fail("CAMERA_MOVE_OUT_OF_RANGE", `camera.moves[${index}] \u8D85\u51FA artifact duration`, {
        index,
        endFrame,
        durationInFrames
      });
    }
    const end = resolveTarget(cursor, move.to, worlds);
    assertCameraAspect(end, viewportWidth, viewportHeight);
    const resolved = Object.freeze({
      startFrame,
      endFrame,
      start: cursor,
      end,
      path: move.path ?? { kind: "linear" },
      ease: move.ease ?? "linear"
    });
    previousEnd = endFrame;
    cursor = end;
    return resolved;
  });
  const frames = [];
  for (let frame = 0;frame <= durationInFrames; frame += 1) {
    let pose = initial;
    for (const move of moves) {
      if (frame < move.startFrame)
        break;
      if (frame >= move.endFrame) {
        pose = move.end;
        continue;
      }
      const progress = ease((frame - move.startFrame) / (move.endFrame - move.startFrame), move.ease);
      pose = interpolate(move.start, move.end, move.path, progress);
      break;
    }
    frames.push(Object.freeze({
      frame,
      pose,
      matrix: cameraMatrix(pose, viewportWidth, viewportHeight)
    }));
  }
  return Object.freeze(frames);
}
function resolveUniverseSourceFrames(input) {
  if (isCameraDefinition(input.camera))
    return resolveUniverseFrames({ ...input, camera: input.camera });
  const program = input.camera;
  const cameraFrames = new Map(Object.entries(program.cameras).map(([id, camera]) => [
    id,
    resolveUniverseFrames({ ...input, camera })
  ]));
  let previousCut = -1;
  const cuts = program.cuts.map((cut, index) => {
    const frame = resolveTimeFrames(cut.at, input.fps, `camera.cuts[${index}].at`);
    if (frame <= previousCut) {
      fail("INVALID_CAMERA_PROGRAM", "Camera Cut \u5FC5\u987B\u6309\u65F6\u95F4\u4E25\u683C\u9012\u589E\u4E14\u4E0D\u80FD\u540C\u5E27\u91CD\u590D", { index, frame });
    }
    if (frame < 0 || frame > input.durationInFrames) {
      fail("CAMERA_CUT_OUT_OF_RANGE", `camera.cuts[${index}] \u8D85\u51FA artifact duration`, {
        index,
        frame,
        durationInFrames: input.durationInFrames
      });
    }
    previousCut = frame;
    return { frame, to: cut.to };
  });
  let active = program.initialCamera;
  let cutIndex = 0;
  const frames = [];
  for (let frame = 0;frame <= input.durationInFrames; frame += 1) {
    let cut = false;
    while (cuts[cutIndex] !== undefined && cuts[cutIndex].frame <= frame) {
      active = cuts[cutIndex].to;
      cutIndex += 1;
      cut = true;
    }
    const selected = cameraFrames.get(active)?.[frame];
    if (selected === undefined) {
      fail("INVALID_CAMERA_PROGRAM", `Camera "${active}" \u7F3A\u5C11 frame ${frame}`, { active, frame });
    }
    frames.push(cut ? Object.freeze({ ...selected, cut: true }) : selected);
  }
  return Object.freeze(frames);
}
function frustum(pose, overscan) {
  const width = pose.width / pose.zoom * (1 + 2 * overscan);
  const height = pose.height / pose.zoom * (1 + 2 * overscan);
  return [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 }
  ].map((entry) => {
    const rotated = rotate(entry, pose.rotation);
    return { x: pose.x + rotated.x, y: pose.y + rotated.y };
  });
}
function projectionsOverlap(left, right, axis) {
  const project = (polygon) => {
    const values = polygon.map((entry) => entry.x * axis.x + entry.y * axis.y);
    return { minimum: Math.min(...values), maximum: Math.max(...values) };
  };
  const a = project(left);
  const b = project(right);
  return a.maximum + GEOMETRY_EPSILON >= b.minimum && b.maximum + GEOMETRY_EPSILON >= a.minimum;
}
function polygonsIntersect(left, right) {
  const axes = [];
  for (const polygon of [left, right]) {
    for (let index = 0;index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      axes.push({ x: -(next.y - current.y), y: next.x - current.x });
    }
  }
  return axes.every((axis) => projectionsOverlap(left, right, axis));
}
function classifyWorldVisibility(bounds, pose, overscan) {
  if (bounds.cull === "never")
    return "visible";
  if (polygonsIntersect(bounds.polygon, frustum(pose, 0)))
    return "visible";
  if (overscan > 0 && polygonsIntersect(bounds.polygon, frustum(pose, overscan))) {
    return "near-visible";
  }
  return "invisible";
}

// src/universe.ts
var UniverseContext = createContext3(undefined);
function invalidWorld(field2, value, positive2 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || positive2 && value <= 0) {
    throw new SdkError("INVALID_WORLD_TRANSFORM", `${field2} \u5FC5\u987B\u662F${positive2 ? "\u6B63" : ""}\u6709\u9650\u6570`, { field: field2, value });
  }
  return value;
}
function normalizedAnchor(value) {
  const result = value ?? { x: 0.5, y: 0.5 };
  const x = invalidWorld("World.anchor.x", result.x);
  const y = invalidWorld("World.anchor.y", result.y);
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    throw new SdkError("INVALID_WORLD_TRANSFORM", "World.anchor \u5FC5\u987B\u4F4D\u4E8E 0\u20141", { anchor: { x, y } });
  }
  return Object.freeze({ x, y });
}
function allEqual(values) {
  return values.every((value) => value === values[0]);
}
function Universe(props) {
  if (!isCameraSource(props.camera)) {
    throw new SdkError("INVALID_CAMERA", "Universe.camera \u5FC5\u987B\u7531 defineCamera() \u6216 defineCameraProgram() \u521B\u5EFA");
  }
  const overscan = props.overscan ?? 0.25;
  if (!Number.isFinite(overscan) || overscan < 0) {
    throw new SdkError("INVALID_CAMERA", "Universe.overscan \u5FC5\u987B\u662F\u6709\u9650\u975E\u8D1F\u6570", { overscan });
  }
  const composition = useFourierContext();
  const timeline = useFourierTimeline();
  const viewport = useRef3(null);
  const plane = useRef3(null);
  const worlds = useRef3(new Map);
  const registry = useMemo3(() => Object.freeze({
    register(bounds) {
      if (worlds.current.has(bounds.id)) {
        throw new SdkError("DUPLICATE_WORLD_ID", `\u540C\u4E00 Universe \u4E2D\u7684 World id "${bounds.id}" \u91CD\u590D`, { id: bounds.id });
      }
      worlds.current.set(bounds.id, bounds);
      return () => {
        if (worlds.current.get(bounds.id) === bounds)
          worlds.current.delete(bounds.id);
      };
    }
  }), []);
  const initialPose = useMemo3(() => {
    const camera = initialCamera(props.camera);
    return Object.freeze({
      ...camera.initial,
      width: camera.width,
      height: camera.height
    });
  }, [props.camera]);
  const initialMatrix = cameraMatrix(initialPose, composition.width, composition.height);
  useLayoutEffect3(() => {
    if (viewport.current === null || plane.current === null) {
      throw new SdkError("UNIVERSE_PLANE_MISSING", "Universe viewport/world plane \u672A\u6302\u8F7D");
    }
    const viewportWidth = viewport.current.clientWidth;
    const viewportHeight = viewport.current.clientHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      throw new SdkError("UNIVERSE_VIEWPORT_INVALID", "Universe \u5FC5\u987B\u653E\u5728\u5177\u6709\u6B63\u5C3A\u5BF8\u7684\u5E03\u5C40\u5BB9\u5668\u5185", { width: viewportWidth, height: viewportHeight });
    }
    const frames = resolveUniverseSourceFrames({
      camera: props.camera,
      worlds: worlds.current,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
      viewportWidth,
      viewportHeight
    });
    const transforms = frames.map((frame) => frame.matrix);
    if (allEqual(transforms)) {
      plane.current.style.transform = transforms[0];
    } else {
      timeline.animate(plane.current, frames.flatMap((frame, index) => {
        const current = {
          offset: frame.frame / composition.durationInFrames,
          transform: frame.matrix,
          easing: "linear"
        };
        if (frame.cut !== true || index === 0)
          return [current];
        return [{ ...current, transform: frames[index - 1].matrix }, current];
      }), {
        duration: composition.durationMilliseconds,
        easing: "linear",
        fill: "both"
      });
    }
    for (const bounds of worlds.current.values()) {
      if (bounds.cull === "never")
        continue;
      const visibility = frames.map((frame) => classifyWorldVisibility(bounds, frame.pose, overscan) === "invisible" ? "hidden" : "visible");
      if (allEqual(visibility)) {
        bounds.element.style.visibility = visibility[0];
        continue;
      }
      timeline.animate(bounds.element, frames.map((frame, index) => ({
        offset: frame.frame / composition.durationInFrames,
        visibility: visibility[index],
        easing: "steps(1, end)"
      })), {
        duration: composition.durationMilliseconds,
        easing: "linear",
        fill: "both"
      });
    }
  }, [composition, overscan, props.camera, timeline]);
  return React2.createElement("div", {
    ref: viewport,
    "data-fourier-universe": "",
    style: {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden"
    },
    children: React2.createElement(UniverseContext.Provider, { value: registry }, React2.createElement("div", {
      ref: plane,
      "data-fourier-world-plane": "",
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        overflow: "visible",
        transformOrigin: "0 0",
        transform: initialMatrix
      },
      children: props.children
    }))
  });
}
function World(props) {
  const registry = useContext3(UniverseContext);
  if (registry === undefined) {
    throw new SdkError("UNIVERSE_REQUIRED", "World \u53EA\u80FD\u5728 Universe \u5185\u4F7F\u7528");
  }
  if (typeof props.id !== "string" || props.id.length === 0) {
    throw new SdkError("INVALID_WORLD_TRANSFORM", "World.id \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
  }
  const x = invalidWorld("World.x", props.x);
  const y = invalidWorld("World.y", props.y);
  const width = invalidWorld("World.width", props.width, true);
  const height = invalidWorld("World.height", props.height, true);
  const rotation = invalidWorld("World.rotation", props.rotation ?? 0);
  const scale = invalidWorld("World.scale", props.scale ?? 1, true);
  const zIndex = invalidWorld("World.zIndex", props.zIndex ?? 0);
  const anchor = normalizedAnchor(props.anchor);
  const cull = props.cull ?? "auto";
  if (cull !== "auto" && cull !== "never") {
    throw new SdkError("INVALID_WORLD_TRANSFORM", "World.cull \u5FC5\u987B\u662F auto \u6216 never");
  }
  const element = useRef3(null);
  useLayoutEffect3(() => {
    if (element.current === null) {
      throw new SdkError("WORLD_ELEMENT_MISSING", `World "${props.id}" \u672A\u6302\u8F7D`);
    }
    return registry.register(Object.freeze({
      id: props.id,
      polygon: worldPolygon({ id: props.id, x, y, width, height, anchor, rotation, scale }),
      cull,
      element: element.current
    }));
  }, [anchor, cull, height, props.id, registry, rotation, scale, width, x, y]);
  const transform = rotation === 0 && scale === 1 ? undefined : `rotate(${rotation}deg) scale(${scale})`;
  return React2.createElement("div", {
    ref: element,
    "data-fourier-world": props.id,
    "data-fourier-cull": cull,
    style: {
      position: "absolute",
      left: x - anchor.x * width,
      top: y - anchor.y * height,
      width,
      height,
      zIndex,
      transformOrigin: `${anchor.x * 100}% ${anchor.y * 100}%`,
      ...transform === undefined ? {} : { transform }
    },
    children: props.children
  });
}

// src/phy2d.ts
function fail2(field2, message, value) {
  throw new SdkError("INVALID_PHY2D_CONFIG", `Phy2D ${field2} ${message}`, { field: field2, value });
}
function finite3(value, field2) {
  if (!Number.isFinite(value))
    fail2(field2, "must be finite", value);
  return value;
}
function positive2(value, field2) {
  finite3(value, field2);
  if (value <= 0)
    fail2(field2, "must be greater than 0", value);
  return value;
}
function unit(value, field2) {
  finite3(value, field2);
  if (value < 0 || value > 1)
    fail2(field2, "must be between 0 and 1", value);
  return value;
}
function vector(value, field2) {
  return { x: finite3(value.x, `${field2}.x`), y: finite3(value.y, `${field2}.y`) };
}
function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}
function polygonArea(particles) {
  let twiceArea = 0;
  for (let index = 0;index < particles.length; index += 1) {
    const current = particles[index];
    const next = particles[(index + 1) % particles.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea * 0.5;
}
function centroid(particles) {
  let x = 0;
  let y = 0;
  for (const particle of particles) {
    x += particle.x;
    y += particle.y;
  }
  return { x: x / particles.length, y: y / particles.length };
}
function makeBody(id, options) {
  const center = vector(options.center, "softBody.center");
  const radius = positive2(options.radius, "softBody.radius");
  const particleCount = options.particleCount ?? 18;
  if (!Number.isSafeInteger(particleCount) || particleCount < 8 || particleCount > 128) {
    fail2("softBody.particleCount", "must be a safe integer between 8 and 128", particleCount);
  }
  const phase = finite3(options.phase ?? 0, "softBody.phase");
  const structuralStiffness = unit(options.structuralStiffness ?? 0.94, "softBody.structuralStiffness");
  const bendingStiffness = unit(options.bendingStiffness ?? 0.38, "softBody.bendingStiffness");
  const shapeStiffness = unit(options.shapeStiffness ?? 0.055, "softBody.shapeStiffness");
  const pressureStiffness = unit(options.pressureStiffness ?? 0.16, "softBody.pressureStiffness");
  if (options.initialVelocities !== undefined && options.initialVelocities.length !== particleCount) {
    fail2("softBody.initialVelocities", "must match particleCount", options.initialVelocities.length);
  }
  const particles = Array.from({ length: particleCount }, (_, index) => {
    const angle = phase + index / particleCount * Math.PI * 2;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    const velocity = options.initialVelocities?.[index] ?? { x: 0, y: 0 };
    vector(velocity, `softBody.initialVelocities[${index}]`);
    return {
      x,
      y,
      previousX: x - velocity.x,
      previousY: y - velocity.y
    };
  });
  const constraints = [];
  for (let index = 0;index < particleCount; index += 1) {
    for (const [span, stiffness] of [
      [1, structuralStiffness],
      [2, bendingStiffness],
      [Math.floor(particleCount / 2), shapeStiffness]
    ]) {
      const other = (index + span) % particleCount;
      if (span === Math.floor(particleCount / 2) && index >= other)
        continue;
      constraints.push({
        a: index,
        b: other,
        rest: distance(particles[index], particles[other]),
        stiffness
      });
    }
  }
  return {
    id,
    particles,
    constraints,
    restArea: Math.abs(polygonArea(particles)),
    pressureStiffness
  };
}
function solveDistance(body, constraint, targetStructureScale) {
  const left = body.particles[constraint.a];
  const right = body.particles[constraint.b];
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const current = Math.hypot(dx, dy);
  if (current < 0.000001)
    return;
  const targetLength = constraint.rest * targetStructureScale;
  const correction = (current - targetLength) / current * constraint.stiffness * 0.5;
  left.x += dx * correction;
  left.y += dy * correction;
  right.x -= dx * correction;
  right.y -= dy * correction;
}
function solveArea(body, targetScale) {
  const currentArea = polygonArea(body.particles);
  const error = currentArea - body.restArea * targetScale;
  let denominator = 0;
  const gradients = [];
  for (let index = 0;index < body.particles.length; index += 1) {
    const previous = body.particles[(index - 1 + body.particles.length) % body.particles.length];
    const next = body.particles[(index + 1) % body.particles.length];
    const gradient = {
      x: (next.y - previous.y) * 0.5,
      y: (previous.x - next.x) * 0.5
    };
    gradients.push(gradient);
    denominator += gradient.x * gradient.x + gradient.y * gradient.y;
  }
  if (denominator < 0.000001)
    return;
  const multiplier = error / denominator * body.pressureStiffness;
  for (let index = 0;index < body.particles.length; index += 1) {
    const particle = body.particles[index];
    const gradient = gradients[index];
    particle.x -= gradient.x * multiplier;
    particle.y -= gradient.y * multiplier;
  }
}
function pointInside(point2, polygon) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1;current < polygon.length; previous = current, current += 1) {
    const a = polygon[current];
    const b = polygon[previous];
    if (a.y > point2.y !== b.y > point2.y && point2.x < (b.x - a.x) * (point2.y - a.y) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
function projectOut(point2, polygon, polygonCenter, relaxation) {
  if (!pointInside(point2, polygon))
    return;
  let closestX = point2.x;
  let closestY = point2.y;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;
  for (let index = 0;index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared < 0.000001 ? 0 : Math.max(0, Math.min(1, ((point2.x - start.x) * dx + (point2.y - start.y) * dy) / lengthSquared));
    const x = start.x + dx * projection;
    const y = start.y + dy * projection;
    const distanceSquared = (point2.x - x) ** 2 + (point2.y - y) ** 2;
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestX = x;
      closestY = y;
    }
  }
  let normalX = closestX - polygonCenter.x;
  let normalY = closestY - polygonCenter.y;
  const normalLength = Math.hypot(normalX, normalY) || 1;
  normalX /= normalLength;
  normalY /= normalLength;
  point2.x += (closestX - point2.x + normalX * 1.6) * relaxation;
  point2.y += (closestY - point2.y + normalY * 1.6) * relaxation;
}

class Phy2dWorldImplementation {
  width;
  height;
  #gravity;
  #damping;
  #solverIterations;
  #wallPadding;
  #bodies = [];
  #stepCount = 0;
  constructor(options) {
    this.width = positive2(options.width, "world.width");
    this.height = positive2(options.height, "world.height");
    this.#gravity = vector(options.gravity ?? { x: 0, y: 0 }, "world.gravity");
    this.#damping = unit(options.damping ?? 0.955, "world.damping");
    this.#wallPadding = finite3(options.wallPadding ?? 0, "world.wallPadding");
    if (this.#wallPadding < 0 || this.#wallPadding * 2 >= Math.min(this.width, this.height)) {
      fail2("world.wallPadding", "must fit within the world bounds", this.#wallPadding);
    }
    this.#solverIterations = options.solverIterations ?? 6;
    if (!Number.isSafeInteger(this.#solverIterations) || this.#solverIterations < 1 || this.#solverIterations > 64) {
      fail2("world.solverIterations", "must be a safe integer between 1 and 64", this.#solverIterations);
    }
  }
  get bodyCount() {
    return this.#bodies.length;
  }
  get stepCount() {
    return this.#stepCount;
  }
  addSoftBody(options) {
    const body = makeBody(this.#bodies.length, options);
    this.#bodies.push(body);
    return Object.freeze({ id: body.id });
  }
  step(options = {}) {
    const targetAreaScale = positive2(options.targetAreaScale ?? 1, "step.targetAreaScale");
    const targetStructureScale = positive2(options.targetStructureScale ?? 1, "step.targetStructureScale");
    const collisionRelaxation = unit(options.collisionRelaxation ?? 0.42, "step.collisionRelaxation");
    if (options.bodyAccelerations !== undefined && options.bodyAccelerations.length > this.#bodies.length) {
      fail2("step.bodyAccelerations", "cannot contain more entries than bodies", options.bodyAccelerations.length);
    }
    for (let bodyIndex = 0;bodyIndex < this.#bodies.length; bodyIndex += 1) {
      const body = this.#bodies[bodyIndex];
      const acceleration = vector(options.bodyAccelerations?.[bodyIndex] ?? { x: 0, y: 0 }, `step.bodyAccelerations[${bodyIndex}]`);
      for (const particle of body.particles) {
        const velocityX = (particle.x - particle.previousX) * this.#damping;
        const velocityY = (particle.y - particle.previousY) * this.#damping;
        particle.previousX = particle.x;
        particle.previousY = particle.y;
        particle.x += velocityX + this.#gravity.x + acceleration.x;
        particle.y += velocityY + this.#gravity.y + acceleration.y;
      }
    }
    for (let iteration = 0;iteration < this.#solverIterations; iteration += 1) {
      for (const body of this.#bodies) {
        for (const constraint of body.constraints) {
          solveDistance(body, constraint, targetStructureScale);
        }
        solveArea(body, targetAreaScale);
        this.#solveWalls(body);
      }
      this.#solveCollisions(collisionRelaxation);
    }
    this.#stepCount += 1;
  }
  snapshot() {
    return Object.freeze({
      step: this.#stepCount,
      bodies: Object.freeze(this.#bodies.map((body) => {
        const center = centroid(body.particles);
        return Object.freeze({
          id: body.id,
          center: Object.freeze(center),
          area: Math.abs(polygonArea(body.particles)),
          restArea: body.restArea,
          particles: Object.freeze(body.particles.map((particle) => Object.freeze({ ...particle })))
        });
      }))
    });
  }
  #solveWalls(body) {
    const minimumX = this.#wallPadding;
    const minimumY = this.#wallPadding;
    const maximumX = this.width - this.#wallPadding;
    const maximumY = this.height - this.#wallPadding;
    for (const particle of body.particles) {
      particle.x = Math.max(minimumX, Math.min(maximumX, particle.x));
      particle.y = Math.max(minimumY, Math.min(maximumY, particle.y));
    }
  }
  #solveCollisions(relaxation) {
    if (relaxation <= 0)
      return;
    const centers = this.#bodies.map((body) => centroid(body.particles));
    const radii = this.#bodies.map((body, index) => Math.max(...body.particles.map((particle) => Math.hypot(particle.x - centers[index].x, particle.y - centers[index].y))));
    for (let leftIndex = 0;leftIndex < this.#bodies.length; leftIndex += 1) {
      const left = this.#bodies[leftIndex];
      for (let rightIndex = leftIndex + 1;rightIndex < this.#bodies.length; rightIndex += 1) {
        const right = this.#bodies[rightIndex];
        const leftCenter = centers[leftIndex];
        const rightCenter = centers[rightIndex];
        if (Math.hypot(rightCenter.x - leftCenter.x, rightCenter.y - leftCenter.y) > radii[leftIndex] + radii[rightIndex] + 4)
          continue;
        for (const particle of left.particles) {
          projectOut(particle, right.particles, rightCenter, relaxation);
        }
        for (const particle of right.particles) {
          projectOut(particle, left.particles, leftCenter, relaxation);
        }
      }
    }
  }
}
function createPhy2dWorld(options) {
  return new Phy2dWorldImplementation(options);
}

// src/definitions.ts
import React4 from "react";

// src/types.ts
import {
  SDK_ABI_VERSION,
  SDK_ARTIFACT,
  SDK_ARTIFACT_SYMBOL_KEY
} from "@fourier-video/core/protocol";
var DESIGN_PREVIEW_FPS = 60;
var MAX_DESIGN_PREVIEW_SECONDS = 30;

// src/webgl.ts
import React3, {
  useMemo as useMemo4,
  useRef as useRef4
} from "react";
var FOURIER_FULLSCREEN_VERTEX_SHADER = `
  out vec2 vUv;

  void main() {
    vec2 position = vec2(
      gl_VertexID == 2 ? 3.0 : -1.0,
      gl_VertexID == 1 ? 3.0 : -1.0
    );
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;
function glsl(input, ...values) {
  if (typeof input === "string")
    return input;
  let source = input[0] ?? "";
  for (let index = 0;index < values.length; index += 1) {
    const value = values[index];
    if (typeof value === "number" && !Number.isFinite(value)) {
      sdkFail("INVALID_FOURIER_SHADER", "GLSL \u63D2\u503C number \u5FC5\u987B\u662F\u6709\u9650\u6570", {
        index,
        value
      });
    }
    source += String(value) + (input[index + 1] ?? "");
  }
  return source;
}
var uniformTypes = new Set([
  "float",
  "int",
  "bool",
  "vec2",
  "vec3",
  "vec4",
  "mat3",
  "mat4"
]);
function validateShaderSource(source, field2) {
  if (typeof source !== "string" || source.trim().length === 0) {
    sdkFail("INVALID_FOURIER_SHADER", `Fourier shader ${field2} \u5FC5\u987B\u662F\u975E\u7A7A GLSL`, {
      field: field2
    });
  }
}
function validateUniformLayout(layout) {
  if (typeof layout !== "object" || layout === null || Array.isArray(layout)) {
    sdkFail("INVALID_FOURIER_SHADER", "Fourier shader uniforms \u5FC5\u987B\u662F\u5B57\u6BB5\u5BF9\u8C61");
  }
  for (const [name, type] of Object.entries(layout)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || name.startsWith("gl_") || name.startsWith("uFourier") || name.includes("__")) {
      sdkFail("INVALID_FOURIER_SHADER", `Fourier shader uniform \u540D\u79F0\u975E\u6CD5\u6216\u5C5E\u4E8E\u4FDD\u7559\u547D\u540D\u7A7A\u95F4: ${name}`, { uniform: name });
    }
    if (!uniformTypes.has(type)) {
      sdkFail("INVALID_FOURIER_SHADER", `Fourier shader uniform "${name}" \u7C7B\u578B\u65E0\u6548: ${String(type)}`, { uniform: name, type });
    }
  }
}
function defineFourierShader(input) {
  if (typeof input !== "object" || input === null) {
    sdkFail("INVALID_FOURIER_SHADER", "Fourier shader definition \u5FC5\u987B\u662F\u5BF9\u8C61");
  }
  validateShaderSource(input.fragmentShader, "fragmentShader");
  if (input.vertexShader !== undefined) {
    validateShaderSource(input.vertexShader, "vertexShader");
  }
  if (input.name !== undefined && input.name.trim().length === 0) {
    sdkFail("INVALID_FOURIER_SHADER", "Fourier shader name \u4E0D\u80FD\u4E3A\u7A7A");
  }
  const uniforms = input.uniforms ?? {};
  validateUniformLayout(uniforms);
  const blend = input.blend ?? "replace";
  if (!["replace", "alpha", "additive"].includes(blend)) {
    sdkFail("INVALID_FOURIER_SHADER", `Fourier shader blend \u65E0\u6548: ${blend}`);
  }
  if (input.clearColor !== undefined) {
    finiteTuple(input.clearColor, 4, "clearColor");
  }
  return Object.freeze({
    ...input.name === undefined ? {} : { name: input.name },
    vertexShader: input.vertexShader ?? FOURIER_FULLSCREEN_VERTEX_SHADER,
    fragmentShader: input.fragmentShader,
    uniforms: Object.freeze({ ...uniforms }),
    blend,
    ...input.clearColor === undefined ? {} : { clearColor: Object.freeze([...input.clearColor]) }
  });
}
var FOURIER_GLSL_HEADER = `
precision highp float;
precision highp int;

uniform vec2 uFourierResolution;
uniform float uFourierTime;
uniform float uFourierProgress;
uniform float uFourierDuration;
uniform float uFourierSeed;
`;
var FOURIER_SOURCE_GLSL_HEADER = `uniform sampler2D uFourierSource;
`;
function shaderSource(source, hasSource) {
  const header = FOURIER_GLSL_HEADER + (hasSource ? FOURIER_SOURCE_GLSL_HEADER : "");
  const version2 = source.match(/^\s*#version[^\r\n]*(?:\r?\n|$)/);
  if (version2 === null) {
    return `#version 300 es
${header}
${source}`;
  }
  return `${version2[0]}${header}
${source.slice(version2[0].length)}`;
}
function compileShader(gl, definition, stage, source, hasSource = false) {
  const shader = gl.createShader(stage === "vertex" ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
  if (shader === null) {
    throw new SdkError("FOURIER_SHADER_RESOURCE_FAILED", `\u65E0\u6CD5\u521B\u5EFA ${stage} shader${definition.name === undefined ? "" : ` "${definition.name}"`}`, { stage });
  }
  gl.shaderSource(shader, shaderSource(source, hasSource));
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true)
    return shader;
  const log = gl.getShaderInfoLog(shader)?.trim() || "\u672A\u77E5 GLSL \u7F16\u8BD1\u9519\u8BEF";
  gl.deleteShader(shader);
  throw new SdkError("FOURIER_SHADER_COMPILE_FAILED", `${definition.name ?? "Fourier shader"} \u7684 ${stage} GLSL \u7F16\u8BD1\u5931\u8D25: ${log}`, { stage, log });
}
function linkProgram(gl, definition, hasSource = false) {
  const vertex = compileShader(gl, definition, "vertex", definition.vertexShader, hasSource);
  let fragment;
  try {
    fragment = compileShader(gl, definition, "fragment", definition.fragmentShader, hasSource);
    const program = gl.createProgram();
    if (program === null) {
      throw new SdkError("FOURIER_SHADER_RESOURCE_FAILED", `\u65E0\u6CD5\u521B\u5EFA shader program${definition.name === undefined ? "" : ` "${definition.name}"`}`);
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) === true)
      return program;
    const log = gl.getProgramInfoLog(program)?.trim() || "\u672A\u77E5 GLSL \u94FE\u63A5\u9519\u8BEF";
    gl.deleteProgram(program);
    throw new SdkError("FOURIER_SHADER_LINK_FAILED", `${definition.name ?? "Fourier shader"} \u7684 GLSL \u94FE\u63A5\u5931\u8D25: ${log}`, { log });
  } finally {
    gl.deleteShader(vertex);
    if (fragment !== undefined)
      gl.deleteShader(fragment);
  }
}
function createFourierShaderProgram(gl, definition) {
  return linkProgram(gl, definition);
}
function finiteTuple(value, length, field2) {
  if (!Array.isArray(value) || value.length !== length || value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) {
    throw new SdkError("INVALID_FOURIER_SHADER_UNIFORM", `Fourier shader ${field2} \u5FC5\u987B\u662F ${length} \u4E2A\u6709\u9650 number`, { field: field2, length });
  }
  return value;
}
function setUniform(gl, location, name, type, value) {
  if (type === "bool") {
    if (typeof value !== "boolean") {
      throw new SdkError("INVALID_FOURIER_SHADER_UNIFORM", `Fourier shader uniform "${name}" \u5FC5\u987B\u662F boolean`, { uniform: name, type });
    }
    gl.uniform1i(location, value ? 1 : 0);
    return;
  }
  if (type === "float" || type === "int") {
    if (typeof value !== "number" || !Number.isFinite(value) || type === "int" && (!Number.isInteger(value) || value < -2147483648 || value > 2147483647)) {
      throw new SdkError("INVALID_FOURIER_SHADER_UNIFORM", `Fourier shader uniform "${name}" \u5FC5\u987B\u662F${type === "int" ? " 32-bit \u6574\u6570" : "\u6709\u9650 number"}`, { uniform: name, type, value });
    }
    if (type === "int")
      gl.uniform1i(location, value);
    else
      gl.uniform1f(location, value);
    return;
  }
  const length = type === "vec2" ? 2 : type === "vec3" || type === "mat3" ? type === "vec3" ? 3 : 9 : type === "vec4" ? 4 : 16;
  const tuple = new Float32Array(finiteTuple(value, length, name));
  if (type === "vec2")
    gl.uniform2fv(location, tuple);
  else if (type === "vec3")
    gl.uniform3fv(location, tuple);
  else if (type === "vec4")
    gl.uniform4fv(location, tuple);
  else if (type === "mat3")
    gl.uniformMatrix3fv(location, false, tuple);
  else
    gl.uniformMatrix4fv(location, false, tuple);
}
function configureBlend(gl, blend) {
  if (blend === "replace") {
    gl.disable(gl.BLEND);
    return;
  }
  gl.enable(gl.BLEND);
  if (blend === "additive")
    gl.blendFunc(gl.ONE, gl.ONE);
  else
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}
var builtinUniformNames = [
  "uFourierResolution",
  "uFourierTime",
  "uFourierProgress",
  "uFourierDuration",
  "uFourierSeed",
  "uFourierSource"
];
var SOURCE_COPY_SHADER = defineFourierShader({
  name: "Fourier source copy",
  fragmentShader: `
    in vec2 vUv;
    out vec4 fragColor;
    void main() { fragColor = texture(uFourierSource, vUv); }
  `
});
function loseContext(gl) {
  gl.getExtension("WEBGL_lose_context")?.loseContext();
}
function FourierWebGLCanvas(props) {
  const { width, height, seed } = useFourierContext();
  const canvasRef = useRef4(null);
  const callbacksRef = useRef4({
    onCreate: props.onCreate,
    onFrame: props.onFrame
  });
  callbacksRef.current = {
    onCreate: props.onCreate,
    onFrame: props.onFrame
  };
  const driver = useMemo4(() => {
    let context;
    let cleanup;
    let readyPromise;
    return {
      ready() {
        if (readyPromise !== undefined)
          return readyPromise;
        readyPromise = (async () => {
          const canvas = canvasRef.current;
          if (canvas === null) {
            throw new SdkError("FOURIER_WEBGL_CANVAS_MISSING", "FourierWebGLCanvas \u5728\u521D\u59CB\u5316\u65F6\u627E\u4E0D\u5230 canvas");
          }
          const gl = canvas.getContext("webgl2", {
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance"
          });
          if (gl === null) {
            throw new SdkError("FOURIER_WEBGL2_UNAVAILABLE", "\u5F53\u524D\u6E32\u67D3\u73AF\u5883\u4E0D\u652F\u6301 FourierWebGLCanvas \u6240\u9700\u7684 WebGL2");
          }
          context = Object.freeze({ canvas, gl, width, height, seed });
          try {
            const result = await callbacksRef.current.onCreate?.(context);
            if (typeof result === "function")
              cleanup = result;
          } catch (error) {
            loseContext(gl);
            context = undefined;
            throw error;
          }
        })();
        return readyPromise;
      },
      render(frame) {
        if (context === undefined) {
          throw new SdkError("FOURIER_RENDER_DRIVER_NOT_READY", "FourierWebGLCanvas \u5C1A\u672A\u5B8C\u6210\u521D\u59CB\u5316");
        }
        const result = callbacksRef.current.onFrame(Object.freeze({
          ...context,
          ...frame,
          seed
        }));
        if (typeof result === "object" && result !== null && "then" in result && typeof result.then === "function") {
          throw new SdkError("FOURIER_RENDER_FRAME_ASYNC", "FourierWebGLCanvas.onFrame \u5FC5\u987B\u540C\u6B65\u8FD4\u56DE");
        }
      },
      dispose() {
        cleanup?.();
        if (context !== undefined)
          loseContext(context.gl);
        context = undefined;
      }
    };
  }, [height, seed, width]);
  useFourierRenderDriver(driver);
  return React3.createElement("canvas", {
    ref: canvasRef,
    className: props.className,
    "aria-label": props.ariaLabel,
    width,
    height,
    style: {
      display: "block",
      width,
      height,
      ...props.style
    }
  });
}
function FourierShaderCanvas(props) {
  const { width, height, seed } = useFourierContext();
  const canvasRef = useRef4(null);
  const sourceRef = useRef4(null);
  const uniformsRef = useRef4(props.uniforms);
  uniformsRef.current = props.uniforms;
  const configRef = useRef4({
    shader: props.shader
  });
  const driver = useMemo4(() => {
    let state;
    return {
      async ready() {
        const canvas2 = canvasRef.current;
        if (canvas2 === null) {
          throw new SdkError("FOURIER_SHADER_CANVAS_MISSING", "FourierShaderCanvas \u5728\u521D\u59CB\u5316\u65F6\u627E\u4E0D\u5230 canvas");
        }
        const gl = canvas2.getContext("webgl2", {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          premultipliedAlpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance"
        });
        if (gl === null) {
          throw new SdkError("FOURIER_WEBGL2_UNAVAILABLE", "\u5F53\u524D\u6E32\u67D3\u73AF\u5883\u4E0D\u652F\u6301 FourierShaderCanvas \u6240\u9700\u7684 WebGL2");
        }
        try {
          const shader = configRef.current.shader;
          const hasSource = props.source !== undefined;
          const source = sourceRef.current;
          if (hasSource && source === null) {
            throw new SdkError("FOURIER_SHADER_SOURCE_MISSING", "FourierShaderCanvas \u627E\u4E0D\u5230\u8F93\u5165\u7EB9\u7406");
          }
          if (source !== null)
            await source.decode();
          const program = linkProgram(gl, shader, hasSource);
          const vertexArray = gl.createVertexArray();
          if (vertexArray === null) {
            gl.deleteProgram(program);
            throw new SdkError("FOURIER_SHADER_RESOURCE_FAILED", "\u65E0\u6CD5\u521B\u5EFA\u5168\u5C4F shader vertex array");
          }
          const builtins = Object.freeze(Object.fromEntries(builtinUniformNames.map((name) => [name, gl.getUniformLocation(program, name)])));
          const uniforms = Object.freeze(Object.fromEntries(Object.keys(shader.uniforms).map((name) => [
            name,
            gl.getUniformLocation(program, name)
          ])));
          const sourceTexture = hasSource ? gl.createTexture() : undefined;
          if (hasSource && sourceTexture === null) {
            gl.deleteVertexArray(vertexArray);
            gl.deleteProgram(program);
            throw new SdkError("FOURIER_SHADER_RESOURCE_FAILED", "\u65E0\u6CD5\u521B\u5EFA Shader \u8F93\u5165\u7EB9\u7406");
          }
          const sourceProgram = hasSource && shader.blend !== "replace" ? linkProgram(gl, SOURCE_COPY_SHADER, true) : undefined;
          state = Object.freeze({
            gl,
            program,
            vertexArray,
            builtins,
            uniforms,
            ...sourceTexture === undefined ? {} : { sourceTexture },
            ...sourceProgram === undefined ? {} : { sourceProgram, sourceSampler: gl.getUniformLocation(sourceProgram, "uFourierSource") }
          });
        } catch (error) {
          loseContext(gl);
          throw error;
        }
      },
      render(frame) {
        if (state === undefined) {
          throw new SdkError("FOURIER_RENDER_DRIVER_NOT_READY", "FourierShaderCanvas \u5C1A\u672A\u5B8C\u6210\u521D\u59CB\u5316");
        }
        const { gl, program, vertexArray, builtins, uniforms } = state;
        const shader = configRef.current.shader;
        gl.viewport(0, 0, width, height);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.SCISSOR_TEST);
        if (state.sourceTexture !== undefined) {
          const source2 = sourceRef.current;
          if (source2 === null) {
            throw new SdkError("FOURIER_SHADER_SOURCE_MISSING", "FourierShaderCanvas \u627E\u4E0D\u5230\u8F93\u5165\u7EB9\u7406");
          }
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, state.sourceTexture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source2);
        }
        if (state.sourceProgram !== undefined) {
          gl.disable(gl.BLEND);
          gl.useProgram(state.sourceProgram);
          gl.uniform1i(state.sourceSampler ?? null, 0);
          gl.bindVertexArray(vertexArray);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        } else if (shader.clearColor !== undefined) {
          gl.clearColor(...shader.clearColor);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        configureBlend(gl, shader.blend);
        gl.useProgram(program);
        gl.bindVertexArray(vertexArray);
        const durationSeconds = frame.durationMilliseconds / 1000;
        if (builtins.uFourierResolution !== null) {
          gl.uniform2f(builtins.uFourierResolution, width, height);
        }
        if (builtins.uFourierTime !== null) {
          gl.uniform1f(builtins.uFourierTime, frame.timeSeconds);
        }
        if (builtins.uFourierProgress !== null) {
          gl.uniform1f(builtins.uFourierProgress, frame.progress);
        }
        if (builtins.uFourierDuration !== null) {
          gl.uniform1f(builtins.uFourierDuration, durationSeconds);
        }
        if (builtins.uFourierSeed !== null) {
          gl.uniform1f(builtins.uFourierSeed, seed);
        }
        if (builtins.uFourierSource !== null) {
          gl.uniform1i(builtins.uFourierSource, 0);
        }
        const source = uniformsRef.current;
        const values = typeof source === "function" ? source(Object.freeze({ ...frame, width, height, seed })) : source;
        if (typeof values === "object" && values !== null && "then" in values && typeof values.then === "function") {
          throw new SdkError("FOURIER_SHADER_UNIFORMS_ASYNC", "FourierShaderCanvas uniforms \u5FC5\u987B\u540C\u6B65\u8FD4\u56DE");
        }
        for (const [name, type] of Object.entries(shader.uniforms)) {
          if (values === undefined || !Object.hasOwn(values, name)) {
            throw new SdkError("INVALID_FOURIER_SHADER_UNIFORM", `Fourier shader \u7F3A\u5C11 uniform "${name}"`, { uniform: name, type });
          }
          const location = uniforms[name];
          if (location !== null && location !== undefined) {
            setUniform(gl, location, name, type, values[name]);
          }
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      },
      dispose() {
        if (state === undefined)
          return;
        state.gl.deleteVertexArray(state.vertexArray);
        state.gl.deleteProgram(state.program);
        if (state.sourceProgram !== undefined)
          state.gl.deleteProgram(state.sourceProgram);
        if (state.sourceTexture !== undefined)
          state.gl.deleteTexture(state.sourceTexture);
        loseContext(state.gl);
        state = undefined;
      }
    };
  }, [height, props.source, seed, width]);
  useFourierRenderDriver(driver);
  const canvas = React3.createElement("canvas", {
    ref: canvasRef,
    className: props.className,
    "aria-label": props.ariaLabel,
    width,
    height,
    style: {
      display: "block",
      width,
      height,
      ...props.style
    }
  });
  if (props.source === undefined)
    return canvas;
  return React3.createElement(React3.Fragment, null, React3.createElement("img", {
    ref: sourceRef,
    src: props.source,
    alt: "",
    "data-fourier-subject": "",
    style: { display: "none" }
  }), canvas);
}

// src/definitions.ts
function validateName(name, kind) {
  if (typeof name !== "string" || name.trim().length === 0) {
    sdkFail("INVALID_ARTIFACT_DEFINITION", `${kind} definition.name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
  }
}
function synchronous(value, operation) {
  if (typeof value === "object" && value !== null && "then" in value && typeof value.then === "function") {
    sdkFail("ARTIFACT_ASYNC_RENDER_UNSUPPORTED", `${operation} \u5FC5\u987B\u540C\u6B65\u8FD4\u56DE`);
  }
  return value;
}
function validateDefinition(definition, kind) {
  if (typeof definition.designPreview !== "function") {
    sdkFail("DESIGN_PREVIEW_REQUIRED", `${kind} definition.designPreview \u5FC5\u987B\u5B9E\u73B0\uFF1BSDK artifact \u4E0D\u5141\u8BB8\u7F3A\u5C11\u8BBE\u8BA1\u9884\u89C8\u5165\u53E3`);
  }
  if (typeof definition.component !== "function" || definition.render !== undefined) {
    sdkFail("INVALID_ARTIFACT_DEFINITION", `${kind} definition \u5FC5\u987B\u63D0\u4F9B component\uFF0C\u4E14\u4E0D\u80FD\u63D0\u4F9B render`);
  }
}
function attachMetadata(artifact, metadata) {
  Object.defineProperty(artifact, SDK_ARTIFACT, {
    value: Object.freeze(metadata),
    enumerable: false,
    configurable: false,
    writable: false
  });
  Object.defineProperty(artifact, "displayName", {
    value: metadata.name,
    enumerable: false,
    configurable: false,
    writable: false
  });
  return Object.freeze(artifact);
}
function defineReact(definition) {
  validateName(definition?.name, "React");
  validateDefinition(definition, "React");
  const schema = defineSchema(definition.schema);
  const designPreview = () => synchronous(definition.designPreview(), `${definition.name}.designPreview()`);
  const dom = definition;
  if (dom.static !== undefined && typeof dom.static !== "boolean") {
    sdkFail("INVALID_ARTIFACT_DEFINITION", "React definition.static \u5FC5\u987B\u662F boolean");
  }
  const component = (input) => synchronous(dom.component(input), `${definition.name}.component()`);
  const metadata = {
    package: "@fourier-video/sdk",
    sdkAbiVersion: SDK_ABI_VERSION,
    renderer: "dom-timeline",
    kind: "react",
    name: definition.name,
    schema,
    ...dom.static === undefined ? {} : { static: dom.static },
    component,
    designPreview
  };
  const artifact = (props) => React4.createElement(component, { props: Object.freeze({ ...props }) });
  return attachMetadata(artifact, metadata);
}
function defineMotion(definition) {
  validateName(definition?.name, "Motion");
  validateDefinition(definition, "Motion");
  const ffmpegVideo = definition.videoComposition === "ffmpeg";
  if (!ffmpegVideo && typeof definition.supportsTextMotion !== "boolean") {
    sdkFail("TEXT_MOTION_CAPABILITY_REQUIRED", "Motion definition.supportsTextMotion \u5FC5\u987B\u663E\u5F0F\u58F0\u660E\u4E3A true \u6216 false");
  }
  const textImplementation = ffmpegVideo ? undefined : definition.textComponent;
  if (!ffmpegVideo && definition.supportsTextMotion && typeof textImplementation !== "function") {
    sdkFail("TEXT_MOTION_IMPLEMENTATION_REQUIRED", "\u652F\u6301 Text Motion \u65F6\u5FC5\u987B\u5355\u72EC\u5B9E\u73B0 definition.textComponent");
  }
  if (!ffmpegVideo && !definition.supportsTextMotion && textImplementation !== undefined) {
    sdkFail("INVALID_ARTIFACT_DEFINITION", "\u4E0D\u652F\u6301 Text Motion \u65F6\u4E0D\u80FD\u63D0\u4F9B Text Motion \u5B9E\u73B0");
  }
  if (definition.preview !== undefined && typeof definition.preview !== "function") {
    sdkFail("INVALID_ARTIFACT_DEFINITION", "Motion definition.preview \u5FC5\u987B\u662F\u51FD\u6570");
  }
  if (definition.overlay !== undefined && typeof definition.overlay !== "function") {
    sdkFail("INVALID_ARTIFACT_DEFINITION", "Motion definition.overlay \u5FC5\u987B\u662F\u51FD\u6570");
  }
  if (ffmpegVideo && definition.overlay !== undefined) {
    sdkFail("INVALID_ARTIFACT_DEFINITION", "FFmpeg Video Motion \u4E0D\u80FD\u63D0\u4F9B overlay");
  }
  const schema = defineSchema(definition.schema);
  const designPreview = () => synchronous(definition.designPreview(), `${definition.name}.designPreview()`);
  const preview = definition.preview === undefined ? undefined : (input) => synchronous(definition.preview(input), `${definition.name}.preview()`);
  const overlay = definition.overlay === undefined ? undefined : (input) => synchronous(definition.overlay(input), `${definition.name}.overlay()`);
  if (ffmpegVideo) {
    const dom2 = definition;
    const component2 = (input) => synchronous(dom2.component(input), `${definition.name}.component()`);
    const metadata2 = {
      package: "@fourier-video/sdk",
      sdkAbiVersion: SDK_ABI_VERSION,
      renderer: "dom-timeline-ffmpeg-video",
      videoComposition: "ffmpeg",
      kind: "motion",
      name: definition.name,
      schema,
      component: component2,
      designPreview,
      ...preview === undefined ? {} : { preview }
    };
    const artifact2 = (input) => React4.createElement(component2, {
      video: Object.freeze({ ...input.video }),
      props: Object.freeze({ ...input.props })
    });
    return attachMetadata(artifact2, metadata2);
  }
  const dom = definition;
  const component = (input) => synchronous(dom.component(input), `${definition.name}.component()`);
  const textComponent = dom.supportsTextMotion ? (input) => synchronous(dom.textComponent(input), `${definition.name}.textComponent()`) : undefined;
  const metadata = {
    package: "@fourier-video/sdk",
    sdkAbiVersion: SDK_ABI_VERSION,
    renderer: "dom-timeline",
    kind: "motion",
    name: definition.name,
    schema,
    component,
    supportsTextMotion: dom.supportsTextMotion,
    ...textComponent === undefined ? {} : { textComponent },
    designPreview,
    ...preview === undefined ? {} : { preview },
    ...overlay === undefined ? {} : { overlay }
  };
  const artifact = (input) => React4.createElement(component, {
    subject: input.subject,
    props: Object.freeze({ ...input.props })
  });
  return attachMetadata(artifact, metadata);
}
function defineShader(definition) {
  validateName(definition?.name, "Shader");
  if (typeof definition?.designPreview !== "function") {
    sdkFail("DESIGN_PREVIEW_REQUIRED", "Shader definition.designPreview \u5FC5\u987B\u5B9E\u73B0\uFF1BSDK artifact \u4E0D\u5141\u8BB8\u7F3A\u5C11\u8BBE\u8BA1\u9884\u89C8\u5165\u53E3");
  }
  if (typeof definition.shader !== "object" || definition.shader === null || typeof definition.shader.fragmentShader !== "string") {
    sdkFail("INVALID_ARTIFACT_DEFINITION", "Shader definition.shader \u5FC5\u987B\u7531 defineFourierShader() \u521B\u5EFA");
  }
  const schema = defineSchema(definition.schema);
  const designPreview = () => {
    const preview = synchronous(definition.designPreview(), `${definition.name}.designPreview()`);
    if (typeof preview.subject !== "string" || preview.subject.length === 0) {
      sdkFail("INVALID_DESIGN_PREVIEW", "Shader designPreview.subject \u5FC5\u987B\u662F\u56FE\u7247 URL \u6216 data URI");
    }
    return preview;
  };
  const component = (input) => {
    const source = definition.uniforms;
    const canvasProps = {
      shader: definition.shader,
      source: input.source,
      ...source === undefined ? {} : {
        uniforms: typeof source === "function" ? (frame) => source({
          props: input.props,
          frame
        }) : source
      }
    };
    return React4.createElement(FourierShaderCanvas, canvasProps);
  };
  const metadata = {
    package: "@fourier-video/sdk",
    sdkAbiVersion: SDK_ABI_VERSION,
    renderer: "dom-timeline",
    kind: "shader",
    name: definition.name,
    schema,
    component,
    designPreview
  };
  const artifact = (input) => React4.createElement(component, {
    source: input.source,
    props: Object.freeze({ ...input.props })
  });
  return attachMetadata(artifact, metadata);
}
// src/font.ts
var installedFonts = new WeakMap;
function fontWeight(value) {
  if (value === undefined)
    return "400";
  if (value === "normal" || value === "bold")
    return value;
  if (Number.isInteger(value) && value >= 1 && value <= 1000) {
    return String(value);
  }
  throw new SdkError("INVALID_FONT_OPTIONS", "loadFont weight \u5FC5\u987B\u662F 1\u20141000 \u7684\u6574\u6570\u3001normal \u6216 bold", { weight: value });
}
function fontStyle(value) {
  if (value === undefined)
    return "normal";
  if (value === "normal" || value === "italic" || value === "oblique") {
    return value;
  }
  throw new SdkError("INVALID_FONT_OPTIONS", "loadFont style \u5FC5\u987B\u662F normal\u3001italic \u6216 oblique", { style: value });
}
function hashFontIdentity(value) {
  let first = 2166136261;
  let second = 2654435769;
  for (let index = 0;index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822507);
    second ^= second >>> 13;
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}
function installFont(document2, family, source, weight, style) {
  let installed = installedFonts.get(document2);
  if (installed === undefined) {
    installed = new Set;
    installedFonts.set(document2, installed);
  }
  if (installed.has(family))
    return;
  const element = document2.createElement("style");
  element.dataset.fourierFontFamily = family;
  element.textContent = [
    "@font-face{",
    `font-family:${JSON.stringify(family)};`,
    `src:url(${JSON.stringify(source)});`,
    `font-weight:${weight};`,
    `font-style:${style};`,
    "font-display:block;",
    "}"
  ].join("");
  document2.head.appendChild(element);
  installed.add(family);
}
function loadFont(source, options = {}) {
  if (typeof source !== "string" || source.trim() === "" || /^(?:https?:)?\/\//i.test(source.trim())) {
    throw new SdkError("INVALID_FONT_SOURCE", "loadFont source \u5FC5\u987B\u662F\u975E\u7A7A\u7684\u672C\u5730\u5B57\u4F53 URL \u6216 data URI");
  }
  const weight = fontWeight(options.weight);
  const style = fontStyle(options.style);
  const family = `FourierFont-${hashFontIdentity(`${source}\x00${weight}\x00${style}`)}`;
  if (typeof document !== "undefined") {
    installFont(document, family, source, weight, style);
  }
  return family;
}
// src/fourier-motion.ts
import React5, {
  createContext as createContext4,
  forwardRef as forwardRef2,
  useCallback as useCallback2,
  useContext as useContext4,
  useLayoutEffect as useLayoutEffect4,
  useRef as useRef5
} from "react";
var RootContext = createContext4(false);
function FourierMotion({ children }) {
  const nested = useContext4(RootContext);
  useFourierLifecycle({ fourierStart() {}, fourierEnd() {} });
  if (nested) {
    throw new SdkError("NESTED_FOURIER_MOTION_ROOT", "FourierMotion \u4E0D\u80FD\u5D4C\u5957\uFF1B\u4E00\u4E2A artifact \u53EA\u9700\u8981\u4E00\u4E2A\u6839\u8282\u70B9");
  }
  return React5.createElement(RootContext.Provider, { value: true }, children);
}
var transformKeys = new Set([
  "x",
  "y",
  "z",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "rotateX",
  "rotateY",
  "skewX",
  "skewY"
]);
function dimension(value) {
  if (value === undefined)
    return "0px";
  return typeof value === "number" ? `${value}px` : value;
}
function angle(value) {
  return typeof value === "number" ? `${value}deg` : value;
}
function transformFor(target2) {
  const shortcuts = [...transformKeys].filter((key) => target2[key] !== undefined);
  if (target2.transform !== undefined && shortcuts.length > 0) {
    throw new SdkError("AMBIGUOUS_FOURIER_MOTION_TRANSFORM", "Fourier Motion keyframe \u4E0D\u80FD\u540C\u65F6\u58F0\u660E transform \u4E0E transform shortcut", { fields: shortcuts });
  }
  if (target2.transform !== undefined)
    return target2.transform;
  if (shortcuts.length === 0)
    return;
  const parts = [];
  if (target2.x !== undefined || target2.y !== undefined || target2.z !== undefined) {
    parts.push(`translate3d(${dimension(target2.x)}, ${dimension(target2.y)}, ${dimension(target2.z)})`);
  }
  if (target2.scale !== undefined)
    parts.push(`scale(${target2.scale})`);
  if (target2.scaleX !== undefined)
    parts.push(`scaleX(${target2.scaleX})`);
  if (target2.scaleY !== undefined)
    parts.push(`scaleY(${target2.scaleY})`);
  if (target2.rotate !== undefined)
    parts.push(`rotate(${angle(target2.rotate)})`);
  if (target2.rotateX !== undefined)
    parts.push(`rotateX(${angle(target2.rotateX)})`);
  if (target2.rotateY !== undefined)
    parts.push(`rotateY(${angle(target2.rotateY)})`);
  if (target2.skewX !== undefined)
    parts.push(`skewX(${angle(target2.skewX)})`);
  if (target2.skewY !== undefined)
    parts.push(`skewY(${angle(target2.skewY)})`);
  return parts.join(" ");
}
function nativeKeyframe(target2) {
  const frame = {};
  for (const [property, value] of Object.entries(target2)) {
    if (transformKeys.has(property) || property === "transform")
      continue;
    frame[property] = value;
  }
  const transform = transformFor(target2);
  if (transform !== undefined)
    frame.transform = transform;
  return frame;
}
function keyframesFor(initial, animate) {
  const targets = Array.isArray(animate) ? [...animate] : [animate];
  if (targets.length === 0) {
    throw new SdkError("EMPTY_FOURIER_MOTION_KEYFRAMES", "Fourier Motion animate \u81F3\u5C11\u9700\u8981\u4E00\u4E2A keyframe");
  }
  if (initial !== undefined && initial !== false)
    targets.unshift(initial);
  return targets.map(nativeKeyframe);
}
function easingValue(ease2) {
  if (ease2 === undefined || typeof ease2 === "string")
    return ease2;
  return `cubic-bezier(${ease2.join(",")})`;
}
function animationOptions(transition) {
  if (transition === undefined)
    return {};
  const easing = easingValue(transition.ease);
  return {
    ...transition.duration === undefined ? {} : { duration: transition.duration * 1000 },
    ...transition.delay === undefined ? {} : { delay: transition.delay * 1000 },
    ...easing === undefined ? {} : { easing },
    ...transition.repeat === undefined ? {} : { iterations: transition.repeat + 1 },
    ...transition.repeatType === undefined ? {} : { direction: transition.repeatType === "reverse" ? "alternate" : "normal" },
    ...transition.fill === undefined ? {} : { fill: transition.fill }
  };
}
function assignRef(ref, value) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref !== null) {
    ref.current = value;
  }
}
var componentCache = new Map;
function createMotionComponent(tag) {
  const cached = componentCache.get(tag);
  if (cached !== undefined)
    return cached;
  const Component2 = forwardRef2(function FourierMotionElement(rawProps, forwardedRef) {
    const props = rawProps;
    const insideRoot = useContext4(RootContext);
    const timeline = useFourierTimeline();
    const target2 = useRef5(null);
    const declaration = useRef5({
      initial: props.initial,
      animate: props.animate,
      transition: props.transition
    });
    const setTarget = useCallback2((value) => {
      target2.current = value;
      assignRef(forwardedRef, value);
    }, [forwardedRef]);
    useLayoutEffect4(() => {
      if (!insideRoot) {
        throw new SdkError("FOURIER_MOTION_ROOT_REQUIRED", `motion.${String(tag)} \u5FC5\u987B\u653E\u5728 FourierMotion \u5185`);
      }
      if (target2.current === null) {
        throw new SdkError("FOURIER_MOTION_TARGET_REQUIRED", `motion.${String(tag)} \u672A\u6302\u8F7D\u52A8\u753B\u76EE\u6807`);
      }
      timeline.animate(target2.current, keyframesFor(declaration.current.initial, declaration.current.animate), animationOptions(declaration.current.transition));
    }, [insideRoot, timeline]);
    const {
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...elementProps
    } = props;
    return React5.createElement(tag, { ...elementProps, ref: setTarget });
  });
  Component2.displayName = `motion.${String(tag)}`;
  componentCache.set(tag, Component2);
  return Component2;
}
var factory = Object.freeze({
  create: createMotionComponent
});
var motion = new Proxy(factory, {
  get(target2, property, receiver) {
    if (Reflect.has(target2, property))
      return Reflect.get(target2, property, receiver);
    if (typeof property !== "string")
      return;
    return createMotionComponent(property);
  }
});
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
export {
  validatePreviewConfig,
  useTransition,
  useSyncExternalStore,
  useState,
  useRef,
  useReducer,
  useOptimistic,
  useMemo,
  useLayoutEffect,
  useInsertionEffect,
  useImperativeHandle,
  useId,
  useFourierTimeline,
  useFourierRenderDriver,
  useFourierLifecycle,
  useFourierContext,
  useEffect,
  useDeferredValue,
  useDebugValue,
  useContext,
  useCallback,
  useActionState,
  use,
  startTransition,
  serializeProjectDefinition,
  resolveDesignPreview,
  readProjectElement,
  readProjectDefinition,
  version as reactVersion,
  motion,
  memo,
  loadFont,
  lazy,
  isValidElement2 as isValidElement,
  glsl,
  forwardRef,
  field,
  defineTemplate,
  defineShader,
  defineSchema,
  defineReact,
  defineProject,
  definePreview,
  defineMotion,
  defineFourierShader,
  defineCameraProgram,
  defineCamera,
  createRef,
  createPhy2dWorld,
  createFourierShaderProgram,
  createFourierRuntimeController,
  createFourierPrng,
  createElement,
  createContext,
  cloneElement,
  bindTemplateProps,
  bindSchemaProps,
  World,
  Video,
  Universe,
  Transform,
  Timeline,
  Text,
  Template,
  Suspense,
  Subtitle,
  StrictMode,
  Shader,
  SdkError,
  Scene,
  SDK_SCHEMA_VERSION,
  SDK_SCHEMA_FIELD_PACKAGE,
  SDK_ARTIFACT_SYMBOL_KEY,
  SDK_ARTIFACT,
  SDK_ABI_VERSION,
  ReactLayer,
  default2 as React,
  PureComponent,
  Project,
  Profiler,
  Motion,
  MAX_DESIGN_PREVIEW_SECONDS,
  Image,
  Group,
  Fragment2 as Fragment,
  FourierWebGLCanvas,
  FourierShaderCanvas,
  FourierRuntimeProvider,
  FourierMotion,
  FOURIER_PROJECT_NODE,
  FOURIER_PROJECT_DEFINITION,
  FOURIER_FULLSCREEN_VERTEX_SHADER,
  DESIGN_PREVIEW_FPS,
  Component,
  Children,
  Canvas,
  Audio
};

//# debugId=E525FBB8A4F7E22564756E2164756E21
