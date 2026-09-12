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
export {
  field,
  defineSchema,
  bindSchemaProps,
  SDK_SCHEMA_VERSION,
  SDK_SCHEMA_FIELD_PACKAGE
};

//# debugId=36689160B66A161164756E2164756E21
