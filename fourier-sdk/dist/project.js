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
export {
  serializeProjectDefinition,
  readProjectElement,
  readProjectDefinition,
  defineTemplate,
  defineProject,
  bindTemplateProps,
  Video,
  Transform,
  Timeline,
  Text,
  Template,
  Subtitle,
  Shader,
  Scene,
  ReactLayer,
  Project,
  Motion,
  Image,
  Group,
  FOURIER_PROJECT_NODE,
  FOURIER_PROJECT_DEFINITION,
  Canvas,
  Audio
};

//# debugId=014877265A697A8264756E2164756E21
