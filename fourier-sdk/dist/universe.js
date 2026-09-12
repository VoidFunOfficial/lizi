// @bun
// src/universe.ts
import React2, {
  createContext as createContext2,
  useContext as useContext2,
  useLayoutEffect as useLayoutEffect2,
  useMemo as useMemo2,
  useRef as useRef2
} from "react";

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

// src/runtime.ts
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef
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
function finite(value, field) {
  if (!Number.isFinite(value)) {
    throw new SdkError("INVALID_TIMELINE_ANIMATION_OPTIONS", `FourierTimeline ${field} \u5FC5\u987B\u662F\u6709\u9650\u6570`, { field, value });
  }
  return value;
}
function finiteNonNegative(value, field) {
  const result = finite(value, field);
  if (result < 0) {
    throw new SdkError("INVALID_TIMELINE_ANIMATION_OPTIONS", `FourierTimeline ${field} \u5FC5\u987B\u662F\u975E\u8D1F\u6570`, { field, value });
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
var RuntimeContext = createContext(undefined);
function FourierRuntimeProvider(props) {
  return React.createElement(RuntimeContext.Provider, {
    value: props.bindings,
    children: props.children
  });
}
function useRuntime(operation) {
  const runtime = useContext(RuntimeContext);
  if (runtime === undefined) {
    throw new SdkError("FOURIER_RUNTIME_REQUIRED", `${operation} \u53EA\u80FD\u5728 Fourier DOM timeline runtime \u5185\u4F7F\u7528`);
  }
  return runtime;
}
function useFourierLifecycle(callbacks) {
  const runtime = useRuntime("useFourierLifecycle()");
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const tokenRef = useRef(undefined);
  if (tokenRef.current === undefined)
    tokenRef.current = Symbol("fourier-lifecycle");
  useLayoutEffect(() => runtime.registerLifecycle(tokenRef.current, () => callbacksRef.current), [runtime]);
}
function useFourierContext() {
  return useRuntime("useFourierContext()").stableContext;
}
function useFourierTimeline() {
  const runtime = useRuntime("useFourierTimeline()");
  return useMemo(() => Object.freeze({
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
  const tokenRef = useRef(undefined);
  if (tokenRef.current === undefined)
    tokenRef.current = Symbol("fourier-render-driver");
  useLayoutEffect(() => runtime.registerRenderDriver(tokenRef.current, driver), [runtime, driver]);
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
function finite2(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail("INVALID_CAMERA", `${field} \u5FC5\u987B\u662F\u6709\u9650\u6570`, { field, value });
  }
  return value;
}
function positive(value, field) {
  const result = finite2(value, field);
  if (result <= 0)
    fail("INVALID_CAMERA", `${field} \u5FC5\u987B\u5927\u4E8E 0`, { field, value });
  return result;
}
function point(value, field) {
  return Object.freeze({
    x: finite2(value?.x, `${field}.x`),
    y: finite2(value?.y, `${field}.y`)
  });
}
function timeExpression(value, field) {
  if (typeof value === "string") {
    if (!/^(?:\d+(?:\.\d+)?(?:ms|s|f))+$/.test(value)) {
      fail("INVALID_CAMERA_TIME", `${field} \u4E0D\u662F\u6709\u6548\u65F6\u95F4: ${value}`, { field, value });
    }
    return value;
  }
  if (typeof value !== "object" || value === null || typeof value.source !== "string" || !Number.isInteger(value.frames) || value.frames < 0 || !Number.isFinite(value.seconds) || value.seconds < 0) {
    fail("INVALID_CAMERA_TIME", `${field} \u5FC5\u987B\u662F TimeExpression`, { field });
  }
  return Object.freeze({ ...value });
}
function cameraEase(value, field) {
  const result = value ?? "linear";
  if (typeof result === "string") {
    if (!["linear", "ease", "ease-in", "ease-out", "ease-in-out"].includes(result)) {
      fail("INVALID_CAMERA", `${field} \u4E0D\u662F\u652F\u6301\u7684 Camera easing`, { field, value: result });
    }
    return result;
  }
  if (result.length !== 4 || result.some((entry) => !Number.isFinite(entry)) || result[0] < 0 || result[0] > 1 || result[2] < 0 || result[2] > 1) {
    fail("INVALID_CAMERA", `${field} \u5FC5\u987B\u662F\u6709\u6548 cubic-bezier`, { field });
  }
  return Object.freeze([...result]);
}
function cameraPath(value, field) {
  if (value === undefined || value.kind === "linear") {
    return Object.freeze({ kind: "linear" });
  }
  if (value.kind === "bezier") {
    return Object.freeze({
      kind: "bezier",
      control1: point(value.control1, `${field}.control1`),
      control2: point(value.control2, `${field}.control2`)
    });
  }
  if (value.kind === "arc") {
    const direction = value.direction ?? "shortest";
    if (!["shortest", "clockwise", "counterclockwise"].includes(direction)) {
      fail("INVALID_CAMERA", `${field}.direction \u65E0\u6548`, { field, direction });
    }
    const turns = value.turns ?? 0;
    if (!Number.isSafeInteger(turns) || turns < 0) {
      fail("INVALID_CAMERA", `${field}.turns \u5FC5\u987B\u662F\u975E\u8D1F\u6574\u6570`, { field, turns });
    }
    return Object.freeze({
      kind: "arc",
      center: point(value.center, `${field}.center`),
      direction,
      turns
    });
  }
  if (value.kind === "curve") {
    if (!Array.isArray(value.points) || value.points.length === 0) {
      fail("INVALID_CAMERA", `${field}.points \u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u8DEF\u5F84\u70B9`, { field });
    }
    return Object.freeze({
      kind: "curve",
      points: Object.freeze(value.points.map((entry, index) => point(entry, `${field}.points[${index}]`)))
    });
  }
  if (value.kind === "custom") {
    if (typeof value.sample !== "function") {
      fail("INVALID_CAMERA", `${field}.sample \u5FC5\u987B\u662F\u540C\u6B65\u51FD\u6570`, { field });
    }
    return Object.freeze({ kind: "custom", sample: value.sample });
  }
  fail("INVALID_CAMERA", `${field}.kind \u65E0\u6548`, { field });
}
function padding(value, field) {
  if (value === undefined)
    return;
  if (typeof value === "number") {
    const result2 = finite2(value, field);
    if (result2 < 0)
      fail("INVALID_CAMERA", `${field} \u4E0D\u80FD\u4E3A\u8D1F\u6570`, { field, value });
    return result2;
  }
  const result = {
    top: finite2(value?.top, `${field}.top`),
    right: finite2(value?.right, `${field}.right`),
    bottom: finite2(value?.bottom, `${field}.bottom`),
    left: finite2(value?.left, `${field}.left`)
  };
  if (Object.values(result).some((entry) => entry < 0)) {
    fail("INVALID_CAMERA", `${field} \u4E0D\u80FD\u5305\u542B\u8D1F\u6570`, { field });
  }
  return Object.freeze(result);
}
function target(value, field) {
  if (typeof value !== "object" || value === null) {
    fail("INVALID_CAMERA", `${field} \u5FC5\u987B\u662F Camera target`, { field });
  }
  if (value.kind === "pose") {
    const fields = ["x", "y", "zoom", "rotation", "width", "height"];
    if (fields.every((name) => value[name] === undefined)) {
      fail("INVALID_CAMERA", `${field} pose \u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u5C5E\u6027`, { field });
    }
    const resolved = { kind: "pose" };
    for (const name of fields) {
      if (value[name] === undefined)
        continue;
      resolved[name] = name === "zoom" || name === "width" || name === "height" ? positive(value[name], `${field}.${name}`) : finite2(value[name], `${field}.${name}`);
    }
    return Object.freeze(resolved);
  }
  if (value.kind === "fit") {
    if (typeof value.target !== "string" || value.target.length === 0) {
      fail("INVALID_CAMERA", `${field}.target \u5FC5\u987B\u662F\u975E\u7A7A World id`, { field });
    }
    if (!["contain", "cover", "width", "height"].includes(value.fit)) {
      fail("INVALID_CAMERA", `${field}.fit \u65E0\u6548`, { field, value: value.fit });
    }
    const resolvedPadding = padding(value.padding, `${field}.padding`);
    return Object.freeze({
      kind: "fit",
      target: value.target,
      fit: value.fit,
      ...resolvedPadding === undefined ? {} : { padding: resolvedPadding }
    });
  }
  fail("INVALID_CAMERA", `${field}.kind \u5FC5\u987B\u662F pose \u6216 fit`, { field });
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
function resolveTimeFrames(value, fps, field) {
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
    fail("INVALID_CAMERA_TIME", `${field} \u8D85\u51FA\u53EF\u7528\u5E27\u8303\u56F4`, { field, value });
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
var UniverseContext = createContext2(undefined);
function invalidWorld(field, value, positive2 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || positive2 && value <= 0) {
    throw new SdkError("INVALID_WORLD_TRANSFORM", `${field} \u5FC5\u987B\u662F${positive2 ? "\u6B63" : ""}\u6709\u9650\u6570`, { field, value });
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
  const viewport = useRef2(null);
  const plane = useRef2(null);
  const worlds = useRef2(new Map);
  const registry = useMemo2(() => Object.freeze({
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
  const initialPose = useMemo2(() => {
    const camera = initialCamera(props.camera);
    return Object.freeze({
      ...camera.initial,
      width: camera.width,
      height: camera.height
    });
  }, [props.camera]);
  const initialMatrix = cameraMatrix(initialPose, composition.width, composition.height);
  useLayoutEffect2(() => {
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
  const registry = useContext2(UniverseContext);
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
  const element = useRef2(null);
  useLayoutEffect2(() => {
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
export {
  defineCameraProgram,
  defineCamera,
  World,
  Universe
};

//# debugId=BCB7FFDC28D2096C64756E2164756E21
