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

// src/react-runtime.ts
import { default as default2 } from "react";
import {
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
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

// src/definitions.ts
import React3 from "react";

// src/types.ts
import {
  SDK_ABI_VERSION,
  SDK_ARTIFACT,
  SDK_ARTIFACT_SYMBOL_KEY
} from "@fourier-video/core/protocol";
var DESIGN_PREVIEW_FPS = 60;
var MAX_DESIGN_PREVIEW_SECONDS = 30;

// src/webgl.ts
import React2, {
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

// src/webgl.ts
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
  const canvasRef = useRef3(null);
  const callbacksRef = useRef3({
    onCreate: props.onCreate,
    onFrame: props.onFrame
  });
  callbacksRef.current = {
    onCreate: props.onCreate,
    onFrame: props.onFrame
  };
  const driver = useMemo3(() => {
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
  return React2.createElement("canvas", {
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
  const canvasRef = useRef3(null);
  const sourceRef = useRef3(null);
  const uniformsRef = useRef3(props.uniforms);
  uniformsRef.current = props.uniforms;
  const configRef = useRef3({
    shader: props.shader
  });
  const driver = useMemo3(() => {
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
  const canvas = React2.createElement("canvas", {
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
  return React2.createElement(React2.Fragment, null, React2.createElement("img", {
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
  const artifact = (props) => React3.createElement(component, { props: Object.freeze({ ...props }) });
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
    const artifact2 = (input) => React3.createElement(component2, {
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
  const artifact = (input) => React3.createElement(component, {
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
    return React3.createElement(FourierShaderCanvas, canvasProps);
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
  const artifact = (input) => React3.createElement(component, {
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
// src/three.ts
import React4, {
  useMemo as useMemo4,
  useRef as useRef4
} from "react";
import {
  Mesh,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  TextureLoader as ThreeTextureLoader,
  Vector3,
  WebGLRenderer
} from "three";
export * from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
function resolveFourierTextureSource(source) {
  const value = typeof source === "string" ? source : source instanceof URL ? source.href : source.src;
  if (value.trim().length === 0) {
    throw new TypeError("Fourier TextureLoader \u7684\u56FE\u7247\u5730\u5740\u4E0D\u80FD\u4E3A\u7A7A");
  }
  return value;
}
function textureSourceLabel(source) {
  if (!source.startsWith("data:"))
    return source;
  const separator = source.indexOf(",");
  return separator < 0 ? "data:\u2026" : `${source.slice(0, separator)},\u2026`;
}
function textureDecodeError(source, error) {
  const reason = error instanceof Error ? error.message : error instanceof Event ? error.type : String(error);
  return new Error(`Fourier TextureLoader \u65E0\u6CD5\u89E3\u7801\u56FE\u7247 "${textureSourceLabel(source)}": ${reason}`, { cause: error });
}

class FourierTextureLoader extends ThreeTextureLoader {
  options;
  constructor(manager, options = {}) {
    super(manager);
    this.options = Object.freeze({ ...options });
  }
  load(source, onLoad, onProgress, onError) {
    const url = resolveFourierTextureSource(source);
    return super.load(url, (texture) => {
      if (this.options.colorSpace !== undefined) {
        texture.colorSpace = this.options.colorSpace;
      }
      if (this.options.flipY !== undefined)
        texture.flipY = this.options.flipY;
      onLoad?.(texture);
    }, onProgress, (error) => onError?.(textureDecodeError(url, error)));
  }
  loadAsync(source, onProgress) {
    return new Promise((resolve, reject) => {
      this.load(source, resolve, onProgress, reject);
    });
  }
  loadManyAsync(sources, onProgress) {
    return Promise.all(sources.map((source) => this.loadAsync(source, onProgress)));
  }
}
function FourierCanvas(props) {
  const { width, height } = useFourierContext();
  const canvasRef = useRef4(null);
  const callbacksRef = useRef4({
    onCreate: props.onCreate,
    onFrame: props.onFrame
  });
  callbacksRef.current = {
    onCreate: props.onCreate,
    onFrame: props.onFrame
  };
  const configRef = useRef4({
    camera: props.camera,
    rendererOptions: props.rendererOptions,
    scene: props.scene,
    videoSurface: props.videoSurface
  });
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
            throw new Error("FourierCanvas \u5728\u521D\u59CB\u5316\u65F6\u627E\u4E0D\u5230 canvas");
          }
          const renderer = new WebGLRenderer({
            antialias: true,
            alpha: true,
            premultipliedAlpha: true,
            ...configRef.current.rendererOptions,
            canvas
          });
          renderer.setPixelRatio(1);
          renderer.setSize(width, height, false);
          renderer.outputColorSpace = SRGBColorSpace;
          const scene = configRef.current.scene ?? new Scene;
          const camera = configRef.current.camera ?? new PerspectiveCamera(45, width / height, 0.1, 100);
          if (configRef.current.camera === undefined)
            camera.position.set(0, 0, 5);
          if (camera instanceof PerspectiveCamera) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
          }
          context = Object.freeze({ canvas, renderer, scene, camera, width, height });
          const result = await callbacksRef.current.onCreate?.(context);
          if (typeof result === "function")
            cleanup = result;
        })();
        return readyPromise;
      },
      render(frame) {
        if (context === undefined) {
          throw new Error("FourierCanvas \u5C1A\u672A\u5B8C\u6210\u5F02\u6B65\u521D\u59CB\u5316");
        }
        callbacksRef.current.onFrame?.(Object.freeze({ ...context, ...frame }));
        context.renderer.render(context.scene, context.camera);
        const binding = configRef.current.videoSurface;
        if (binding === undefined)
          return;
        const mesh = binding.meshRef.current;
        if (!(mesh instanceof Mesh)) {
          throw new Error("FourierCanvas videoSurface.meshRef \u5FC5\u987B\u6307\u5411 Three.js Mesh");
        }
        mesh.geometry.computeBoundingBox();
        const bounds = mesh.geometry.boundingBox;
        if (bounds === null) {
          throw new Error("FourierCanvas video surface geometry \u6CA1\u6709\u6709\u6548 bounding box");
        }
        context.scene.updateMatrixWorld(true);
        context.camera.updateMatrixWorld(true);
        const z = (bounds.min.z + bounds.max.z) / 2;
        const project = (x, y) => {
          const point = new Vector3(x, y, z).applyMatrix4(mesh.matrixWorld).project(context.camera);
          return Object.freeze({
            x: (point.x + 1) / 2 * context.width,
            y: (1 - point.y) / 2 * context.height
          });
        };
        return Object.freeze({
          videoSurfaces: Object.freeze([Object.freeze({
            videoId: binding.video.id,
            cornerRadiusRatio: binding.cornerRadiusRatio ?? 0,
            corners: Object.freeze([
              project(bounds.min.x, bounds.max.y),
              project(bounds.max.x, bounds.max.y),
              project(bounds.min.x, bounds.min.y),
              project(bounds.max.x, bounds.min.y)
            ])
          })])
        });
      },
      dispose() {
        cleanup?.();
        context?.renderer.dispose();
        context?.renderer.forceContextLoss();
        context = undefined;
      }
    };
  }, [height, width]);
  useFourierRenderDriver(driver);
  return React4.createElement("canvas", {
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
export {
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
  resolveFourierTextureSource,
  version as reactVersion,
  memo,
  loadFont,
  lazy,
  isValidElement,
  forwardRef,
  field,
  defineSchema,
  defineReact,
  createRef,
  createFourierPrng,
  createElement,
  createContext,
  cloneElement,
  FourierTextureLoader as TextureLoader,
  Suspense,
  StrictMode,
  default2 as React,
  PureComponent,
  Profiler,
  GLTFLoader,
  Fragment,
  FourierTextureLoader,
  FourierCanvas,
  Component,
  Children
};

//# debugId=495B00EA7B1DD6AD64756E2164756E21
