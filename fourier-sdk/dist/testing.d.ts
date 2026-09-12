import { type RationalTimeInput, type TimelineSampleResult } from "@fourier-video/core/timeline";
import type { MotionPreviewDescriptor } from "./types.ts";
export type FrameResult = TimelineSampleResult & {
    readonly frame: number;
};
export type TimeResult = TimelineSampleResult;
export interface RenderFrameRequest {
    frame: number;
    signal?: AbortSignal;
}
export interface RenderTimeRequest {
    time: RationalTimeInput;
    signal?: AbortSignal;
}
export type DeterminismRequest = {
    frames: readonly number[];
    times?: never;
} | {
    frames?: never;
    times: readonly RationalTimeInput[];
};
export interface MotionPreviewInspectionRequest {
    anchorFrame: number;
    range: readonly [number, number];
}
export interface ArtifactFixture {
    readonly kind: "react" | "motion" | "shader";
    readonly name: string;
    readonly snapshotId: string;
    /** Runtime-verified pixel invariance across sample time. */
    readonly isStatic: boolean;
    renderFrame(request: RenderFrameRequest): Promise<FrameResult>;
    renderTime(request: RenderTimeRequest): Promise<TimeResult>;
    assertDeterministic(request: DeterminismRequest): Promise<void>;
    inspectMotionPreview(request: MotionPreviewInspectionRequest): Promise<MotionPreviewDescriptor | undefined>;
    close(): Promise<void>;
}
/** Opens a supported SDK artifact from its source entry path. */
export declare function openArtifact(entryPath: string, options?: {
    exportName?: "default";
    sourceRoot?: string;
    resourceRoots?: readonly string[];
}): Promise<ArtifactFixture>;
export type { RationalTimeInput, TimelineSampleResult };
//# sourceMappingURL=testing.d.ts.map