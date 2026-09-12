// @bun
// src/universe-3d.ts
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

// src/universe-3d-core.ts
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from "three";
var CAMERA_3D_DEFINITION = Symbol("fourier-camera-3d-definition");
var MATRIX_EPSILON = 0.000000000001;
function fail(code, message, details) {
  throw new SdkError(code, message, details);
}
function finite2(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail("INVALID_CAMERA_3D", `${field} \u5FC5\u987B\u662F\u6709\u9650\u6570`, { field, value });
  }
  return value;
}
function positive(value, field) {
  const result = finite2(value, field);
  if (result <= 0) {
    fail("INVALID_CAMERA_3D", `${field} \u5FC5\u987B\u5927\u4E8E 0`, { field, value });
  }
  return result;
}
function normalizePose(value, fallback, field, requireProperty) {
  const names = ["x", "y", "z", "rx", "ry", "rz"];
  if (requireProperty && names.every((name) => value?.[name] === undefined)) {
    fail("INVALID_CAMERA_3D", `${field} \u81F3\u5C11\u9700\u8981\u4E00\u4E2A x/y/z/rx/ry/rz \u5C5E\u6027`, { field });
  }
  return Object.freeze({
    x: finite2(value?.x ?? fallback.x, `${field}.x`),
    y: finite2(value?.y ?? fallback.y, `${field}.y`),
    z: finite2(value?.z ?? fallback.z, `${field}.z`),
    rx: finite2(value?.rx ?? fallback.rx, `${field}.rx`),
    ry: finite2(value?.ry ?? fallback.ry, `${field}.ry`),
    rz: finite2(value?.rz ?? fallback.rz, `${field}.rz`)
  });
}
function normalizePoseInput(value, field) {
  const names = ["x", "y", "z", "rx", "ry", "rz"];
  if (names.every((name) => value?.[name] === undefined)) {
    fail("INVALID_CAMERA_3D", `${field} \u81F3\u5C11\u9700\u8981\u4E00\u4E2A x/y/z/rx/ry/rz \u5C5E\u6027`, { field });
  }
  const result = {};
  for (const name of names) {
    if (value[name] !== undefined)
      result[name] = finite2(value[name], `${field}.${name}`);
  }
  return Object.freeze(result);
}
function timeExpression(value, field) {
  if (typeof value === "string") {
    if (!/^(?:\d+(?:\.\d+)?(?:ms|s|f))+$/.test(value)) {
      fail("INVALID_CAMERA_3D_TIME", `${field} \u4E0D\u662F\u6709\u6548\u65F6\u95F4: ${value}`, { field, value });
    }
    return value;
  }
  if (typeof value !== "object" || value === null || typeof value.source !== "string" || !Number.isInteger(value.frames) || value.frames < 0 || !Number.isFinite(value.seconds) || value.seconds < 0) {
    fail("INVALID_CAMERA_3D_TIME", `${field} \u5FC5\u987B\u662F TimeExpression`, { field });
  }
  return Object.freeze({ ...value });
}
function cameraEase(value, field) {
  const result = value ?? "linear";
  if (typeof result === "string") {
    if (!["linear", "ease", "ease-in", "ease-out", "ease-in-out"].includes(result)) {
      fail("INVALID_CAMERA_3D", `${field} \u4E0D\u662F\u652F\u6301\u7684 Camera3D easing`, { field, value: result });
    }
    return result;
  }
  if (result.length !== 4 || result.some((entry) => !Number.isFinite(entry)) || result[0] < 0 || result[0] > 1 || result[2] < 0 || result[2] > 1) {
    fail("INVALID_CAMERA_3D", `${field} \u5FC5\u987B\u662F\u6709\u6548 cubic-bezier`, { field });
  }
  return Object.freeze([...result]);
}
function defineCamera3D(input) {
  if (typeof input !== "object" || input === null) {
    fail("INVALID_CAMERA_3D", "defineCamera3D() \u9700\u8981\u914D\u7F6E\u5BF9\u8C61");
  }
  const origin = Object.freeze({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });
  const initial = normalizePose(input.initial, origin, "camera3D.initial", false);
  const fov = positive(input.fov ?? 50, "camera3D.fov");
  if (fov >= 180) {
    fail("INVALID_CAMERA_3D", "camera3D.fov \u5FC5\u987B\u5C0F\u4E8E 180", { fov });
  }
  const moves = Object.freeze((input.moves ?? []).map((move, index) => {
    if (typeof move !== "object" || move === null) {
      fail("INVALID_CAMERA_3D", `camera3D.moves[${index}] \u5FC5\u987B\u662F\u5BF9\u8C61`);
    }
    return Object.freeze({
      at: timeExpression(move.at, `camera3D.moves[${index}].at`),
      duration: timeExpression(move.duration, `camera3D.moves[${index}].duration`),
      to: normalizePoseInput(move.to, `camera3D.moves[${index}].to`),
      ease: cameraEase(move.ease, `camera3D.moves[${index}].ease`)
    });
  }));
  return Object.freeze({
    fov,
    initial,
    moves,
    [CAMERA_3D_DEFINITION]: true
  });
}
function isCamera3D(value) {
  return typeof value === "object" && value !== null && value[CAMERA_3D_DEFINITION] === true;
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
    fail("INVALID_CAMERA_3D_TIME", `${field} \u8D85\u51FA\u53EF\u7528\u5E27\u8303\u56F4`, { field, value });
  }
  return rounded;
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
function easedProgress(progress, value) {
  const curves = {
    linear: [0, 0, 1, 1],
    ease: [0.25, 0.1, 0.25, 1],
    "ease-in": [0.42, 0, 1, 1],
    "ease-out": [0, 0, 0.58, 1],
    "ease-in-out": [0.42, 0, 0.58, 1]
  };
  return cubicBezier(progress, typeof value === "string" ? curves[value] : value);
}
function interpolatePose(start, end, progress) {
  const lerp = (left, right) => left + (right - left) * progress;
  return Object.freeze({
    x: lerp(start.x, end.x),
    y: lerp(start.y, end.y),
    z: lerp(start.z, end.z),
    rx: lerp(start.rx, end.rx),
    ry: lerp(start.ry, end.ry),
    rz: lerp(start.rz, end.rz)
  });
}
function matrix3D(matrix) {
  const values = matrix.elements.map((value) => Math.abs(value) < MATRIX_EPSILON ? 0 : Number(value.toFixed(12)));
  return `matrix3d(${values.join(", ")})`;
}
function camera3DMatrix(pose) {
  const position = new Vector3(pose.x, pose.y, pose.z);
  const quaternion = new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(pose.rx), MathUtils.degToRad(pose.ry), MathUtils.degToRad(pose.rz), "XYZ"));
  const world = new Matrix4().compose(position, quaternion, new Vector3(1, 1, 1));
  return matrix3D(world.invert());
}
function world3DMatrix(transform) {
  const scale = positive(transform.scale ?? 1, "World3D.scale");
  const position = new Vector3(finite2(transform.x, "World3D.x"), finite2(transform.y, "World3D.y"), finite2(transform.z, "World3D.z"));
  const quaternion = new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(finite2(transform.rx ?? 0, "World3D.rx")), MathUtils.degToRad(finite2(transform.ry ?? 0, "World3D.ry")), MathUtils.degToRad(finite2(transform.rz ?? 0, "World3D.rz")), "XYZ"));
  return matrix3D(new Matrix4().compose(position, quaternion, new Vector3(scale, scale, scale)));
}
function camera3DPerspective(camera, viewportHeight) {
  const height = positive(viewportHeight, "Universe3D.viewportHeight");
  return height / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2));
}
function resolveCamera3DFrames(input) {
  if (!isCamera3D(input.camera)) {
    fail("INVALID_CAMERA_3D", "camera \u5FC5\u987B\u7531 defineCamera3D() \u521B\u5EFA");
  }
  if (!Number.isSafeInteger(input.durationInFrames) || input.durationInFrames <= 0) {
    fail("INVALID_CAMERA_3D", "composition.durationInFrames \u5FC5\u987B\u662F\u6B63\u6574\u6570");
  }
  let previousEnd = 0;
  let cursor = input.camera.initial;
  const moves = input.camera.moves.map((move, index) => {
    const startFrame = resolveTimeFrames(move.at, input.fps, `camera3D.moves[${index}].at`);
    const durationFrames = resolveTimeFrames(move.duration, input.fps, `camera3D.moves[${index}].duration`);
    if (durationFrames <= 0) {
      fail("INVALID_CAMERA_3D_TIME", `camera3D.moves[${index}].duration \u5FC5\u987B\u81F3\u5C11\u4E3A 1 frame`, {
        index
      });
    }
    const endFrame = startFrame + durationFrames;
    if (startFrame < previousEnd) {
      fail("CAMERA_3D_MOVE_OVERLAP", `camera3D.moves[${index}] \u4E0E\u524D\u4E00\u4E2A Move \u91CD\u53E0`, { index });
    }
    if (endFrame > input.durationInFrames) {
      fail("CAMERA_3D_MOVE_OUT_OF_RANGE", `camera3D.moves[${index}] \u8D85\u51FA artifact duration`, {
        index,
        endFrame,
        durationInFrames: input.durationInFrames
      });
    }
    const end = normalizePose(move.to, cursor, `camera3D.moves[${index}].to`, true);
    const resolved = Object.freeze({
      startFrame,
      endFrame,
      start: cursor,
      end,
      ease: move.ease ?? "linear"
    });
    previousEnd = endFrame;
    cursor = end;
    return resolved;
  });
  const frames = [];
  for (let frame = 0;frame <= input.durationInFrames; frame += 1) {
    let pose = input.camera.initial;
    for (const move of moves) {
      if (frame < move.startFrame)
        break;
      if (frame >= move.endFrame) {
        pose = move.end;
        continue;
      }
      pose = interpolatePose(move.start, move.end, easedProgress((frame - move.startFrame) / (move.endFrame - move.startFrame), move.ease));
      break;
    }
    frames.push(Object.freeze({ frame, pose, matrix: camera3DMatrix(pose) }));
  }
  return Object.freeze(frames);
}

// src/universe-3d.ts
var Universe3DContext = createContext2(undefined);
function finite3(value, field, positive2 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || positive2 && value <= 0) {
    throw new SdkError("INVALID_WORLD_3D_TRANSFORM", `${field} \u5FC5\u987B\u662F${positive2 ? "\u6B63" : ""}\u6709\u9650\u6570`, { field, value });
  }
  return value;
}
function normalizedAnchor(value) {
  const anchor = value ?? { x: 0.5, y: 0.5 };
  const x = finite3(anchor.x, "World3D.anchor.x");
  const y = finite3(anchor.y, "World3D.anchor.y");
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    throw new SdkError("INVALID_WORLD_3D_TRANSFORM", "World3D.anchor \u5FC5\u987B\u4F4D\u4E8E 0\u20141", { anchor: { x, y } });
  }
  return Object.freeze({ x, y });
}
function allEqual(values) {
  return values.every((value) => value === values[0]);
}
function Universe3D(props) {
  if (!isCamera3D(props.camera)) {
    throw new SdkError("INVALID_CAMERA_3D", "Universe3D.camera \u5FC5\u987B\u7531 defineCamera3D() \u521B\u5EFA");
  }
  const composition = useFourierContext();
  const timeline = useFourierTimeline();
  const viewport = useRef2(null);
  const plane = useRef2(null);
  const worldIds = useRef2(new Set);
  const registry = useMemo2(() => Object.freeze({
    register(id) {
      if (worldIds.current.has(id)) {
        throw new SdkError("DUPLICATE_WORLD_3D_ID", `\u540C\u4E00 Universe3D \u4E2D\u7684 World3D id "${id}" \u91CD\u590D`, { id });
      }
      worldIds.current.add(id);
      return () => {
        worldIds.current.delete(id);
      };
    }
  }), []);
  const initialMatrix = useMemo2(() => camera3DMatrix(props.camera.initial), [props.camera]);
  const perspective = useMemo2(() => camera3DPerspective(props.camera, composition.height), [composition.height, props.camera]);
  useLayoutEffect2(() => {
    if (viewport.current === null || plane.current === null) {
      throw new SdkError("UNIVERSE_3D_PLANE_MISSING", "Universe3D viewport/world plane \u672A\u6302\u8F7D");
    }
    const viewportHeight = viewport.current.clientHeight;
    if (viewport.current.clientWidth <= 0 || viewportHeight <= 0) {
      throw new SdkError("UNIVERSE_3D_VIEWPORT_INVALID", "Universe3D \u5FC5\u987B\u653E\u5728\u5177\u6709\u6B63\u5C3A\u5BF8\u7684\u5E03\u5C40\u5BB9\u5668\u5185");
    }
    viewport.current.style.perspective = `${camera3DPerspective(props.camera, viewportHeight)}px`;
    const frames = resolveCamera3DFrames({
      camera: props.camera,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames
    });
    const transforms = frames.map((frame) => frame.matrix);
    if (allEqual(transforms)) {
      plane.current.style.transform = transforms[0];
      return;
    }
    timeline.animate(plane.current, frames.map((frame) => ({
      offset: frame.frame / composition.durationInFrames,
      transform: frame.matrix,
      easing: "linear"
    })), {
      duration: composition.durationMilliseconds,
      easing: "linear",
      fill: "both"
    });
  }, [composition, props.camera, timeline]);
  return React2.createElement("div", {
    ref: viewport,
    "data-fourier-universe-3d": "",
    style: {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      perspective,
      perspectiveOrigin: "50% 50%",
      transformStyle: "preserve-3d"
    },
    children: React2.createElement(Universe3DContext.Provider, { value: registry }, React2.createElement("div", {
      ref: plane,
      "data-fourier-world-3d-plane": "",
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        overflow: "visible",
        transformOrigin: "0 0",
        transformStyle: "preserve-3d",
        transform: initialMatrix
      },
      children: props.children
    }))
  });
}
function World3D(props) {
  const registry = useContext2(Universe3DContext);
  if (registry === undefined) {
    throw new SdkError("UNIVERSE_3D_REQUIRED", "World3D \u53EA\u80FD\u5728 Universe3D \u5185\u4F7F\u7528");
  }
  if (typeof props.id !== "string" || props.id.length === 0) {
    throw new SdkError("INVALID_WORLD_3D_TRANSFORM", "World3D.id \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
  }
  const x = finite3(props.x, "World3D.x");
  const y = finite3(props.y, "World3D.y");
  const z = finite3(props.z, "World3D.z");
  const width = finite3(props.width, "World3D.width", true);
  const height = finite3(props.height, "World3D.height", true);
  const rx = finite3(props.rx ?? 0, "World3D.rx");
  const ry = finite3(props.ry ?? 0, "World3D.ry");
  const rz = finite3(props.rz ?? 0, "World3D.rz");
  const scale = finite3(props.scale ?? 1, "World3D.scale", true);
  const anchor = normalizedAnchor(props.anchor);
  useLayoutEffect2(() => registry.register(props.id), [props.id, registry]);
  return React2.createElement("div", {
    "data-fourier-world-3d": props.id,
    style: {
      position: "absolute",
      left: -anchor.x * width,
      top: -anchor.y * height,
      width,
      height,
      transformOrigin: `${anchor.x * 100}% ${anchor.y * 100}%`,
      transformStyle: "preserve-3d",
      backfaceVisibility: "hidden",
      transform: world3DMatrix({ x, y, z, rx, ry, rz, scale })
    },
    children: props.children
  });
}
export {
  defineCamera3D,
  World3D,
  Universe3D
};

//# debugId=09A2BD7ED0BE652F64756E2164756E21
