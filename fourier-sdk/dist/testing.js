// @bun
// src/testing.ts
import { dirname } from "path";
import {
  SampleClock
} from "@fourier-video/core/timeline";

// src/artifact-host.ts
import { createArtifactHost } from "@fourier-video/core";
var sdkArtifactHost = createArtifactHost({
  resolveAuthorImport: (specifier) => Bun.resolveSync(specifier, import.meta.dir)
});

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

// src/testing.ts
var { compileVisualArtifact, createTimelineRuntime } = sdkArtifactHost;
function ensureDeterminismRequest(request) {
  const hasFrames = Array.isArray(request.frames) && request.frames.length > 0;
  const hasTimes = Array.isArray(request.times) && request.times.length > 0;
  if (hasFrames === hasTimes) {
    throw new SdkError("INVALID_DETERMINISM_REQUEST", "assertDeterministic \u5FC5\u987B\u4E14\u53EA\u80FD\u63D0\u4F9B\u975E\u7A7A frames \u6216 times");
  }
}
function motionPreviewContext(artifact, request) {
  const [rangeStartFrame, rangeEndFrame] = request.range;
  const timing = artifact.motion ?? {
    startFrame: 0,
    durationInFrames: artifact.composition.durationInFrames,
    fill: "both"
  };
  return Object.freeze({
    projectId: `artifact:${artifact.name}`,
    motionId: artifact.name,
    hostId: "artifact-host",
    fps: artifact.composition.fps,
    seed: artifact.seed,
    anchorFrame: request.anchorFrame,
    rangeStartFrame,
    rangeEndFrame,
    canvas: { width: artifact.composition.width, height: artifact.composition.height },
    host: {
      x: artifact.composition.width / 2,
      y: artifact.composition.height / 2,
      width: artifact.composition.width,
      height: artifact.composition.height,
      startFrame: 0,
      endFrame: artifact.composition.durationInFrames
    },
    motion: {
      startFrame: timing.startFrame,
      endFrame: timing.startFrame + timing.durationInFrames,
      durationFrames: timing.durationInFrames
    }
  });
}
function timelineFixture(artifact, runtime, instance) {
  const clock = new SampleClock(artifact.composition.fpsSource);
  let closed = false;
  const ensureOpen = () => {
    if (closed)
      throw new SdkError("ARTIFACT_FIXTURE_CLOSED", "Artifact fixture \u5DF2\u5173\u95ED");
  };
  const renderTime = async (request) => {
    ensureOpen();
    return instance.sample(request);
  };
  return Object.freeze({
    kind: artifact.kind,
    name: artifact.name,
    snapshotId: artifact.snapshotId,
    isStatic: instance.isStatic,
    async renderFrame(request) {
      ensureOpen();
      if (!Number.isInteger(request.frame) || request.frame < 0 || request.frame >= artifact.composition.durationInFrames) {
        throw new SdkError("ARTIFACT_FRAME_OUT_OF_RANGE", "frame \u8D85\u51FA composition \u8303\u56F4");
      }
      const result = await renderTime({
        time: clock.frameStart(request.frame),
        ...request.signal === undefined ? {} : { signal: request.signal }
      });
      return Object.freeze({ ...result, frame: request.frame });
    },
    renderTime,
    async assertDeterministic(request) {
      ensureOpen();
      ensureDeterminismRequest(request);
      const times = request.frames !== undefined ? request.frames.map((frame) => clock.frameStart(frame)) : request.times;
      for (const time of times) {
        const first = await renderTime({ time });
        const second = await renderTime({ time });
        if (first.sha256 !== second.sha256) {
          throw new SdkError("NON_DETERMINISTIC_ARTIFACT", `${artifact.name} \u5728 ${time.numerator}/${time.denominator}s \u4E24\u6B21\u8F93\u51FA\u4E0D\u4E00\u81F4`);
        }
      }
    },
    async inspectMotionPreview(request) {
      ensureOpen();
      if (artifact.kind !== "motion") {
        throw new SdkError("ARTIFACT_KIND_MISMATCH", "\u53EA\u6709 Motion artifact \u652F\u6301 preview descriptor");
      }
      motionPreviewContext(artifact, request);
      return;
    },
    async close() {
      if (closed)
        return;
      closed = true;
      await instance.close();
      await runtime.close();
    }
  });
}
async function openArtifact(entryPath, options = {}) {
  const artifact = await compileVisualArtifact({
    entryPath,
    sourceRoot: options.sourceRoot ?? dirname(entryPath),
    resourceRoots: options.resourceRoots ?? [options.sourceRoot ?? dirname(entryPath)],
    mode: "design-preview",
    ...options.exportName === undefined ? {} : { exportName: options.exportName }
  });
  const runtime = createTimelineRuntime();
  try {
    const instance = await runtime.open(artifact);
    return timelineFixture(artifact, runtime, instance);
  } catch (error) {
    await runtime.close();
    throw error;
  }
}
export {
  openArtifact
};

//# debugId=E2C80C191F86781664756E2164756E21
