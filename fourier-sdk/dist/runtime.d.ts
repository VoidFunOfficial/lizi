import React, { type ReactNode } from "react";
import type { FourierLifecycle, FourierPrng, FourierStableContext, FourierTimeline } from "./types.ts";
export interface FourierRenderFrame {
    /** Absolute host time for this artifact sample. */
    readonly timeMilliseconds: number;
    readonly timeSeconds: number;
    /** Host-normalized progress. A zero-duration host reports 0. */
    readonly progress: number;
    readonly durationMilliseconds: number;
}
export interface FourierProjectedPoint {
    readonly x: number;
    readonly y: number;
}
export interface FourierProjectedVideoSurface {
    readonly videoId: string;
    /** Top-left, top-right, bottom-left, bottom-right in artifact pixels. */
    readonly corners: readonly [
        FourierProjectedPoint,
        FourierProjectedPoint,
        FourierProjectedPoint,
        FourierProjectedPoint
    ];
    readonly cornerRadiusRatio: number;
}
export interface FourierRenderResult {
    readonly videoSurfaces?: readonly FourierProjectedVideoSurface[];
}
/**
 * Host-driven renderer used by non-DOM pixels such as Three.js/WebGL.
 * `ready` may load local bundled assets; `render` must stay synchronous.
 */
export interface FourierRenderDriver {
    ready(): void | Promise<void>;
    render(frame: Readonly<FourierRenderFrame>): void | FourierRenderResult;
    dispose?(): void;
}
export interface FourierRuntimeBindings {
    readonly stableContext: Readonly<FourierStableContext>;
    readonly hostDurationMilliseconds: number;
    registerLifecycle(token: symbol, read: () => FourierLifecycle): () => void;
    registerAnimation(animation: Animation): void;
    registerRenderDriver(token: symbol, driver: FourierRenderDriver): () => void;
}
export interface FourierRuntimeContextInput {
    readonly width: number;
    readonly height: number;
    readonly seed: number;
    /** Defaults to 60 for direct controller consumers. */
    readonly fps?: number;
    /** Derived from host duration when omitted. */
    readonly durationInFrames?: number;
}
export interface FourierRuntimeController {
    readonly bindings: FourierRuntimeBindings;
    getLifecycle(): FourierLifecycle | undefined;
    getAnimations(): readonly Animation[];
    prepareRenderDrivers(): Promise<void>;
    renderFrame(timeMilliseconds: number): FourierRenderResult;
    getRenderState(): Readonly<{
        driverCount: number;
        timeMilliseconds: number | null;
        videoSurfaces: readonly FourierProjectedVideoSurface[];
    }>;
}
export declare function createFourierRuntimeController(stableContext: FourierRuntimeContextInput, hostDurationMilliseconds: number): FourierRuntimeController;
export declare function FourierRuntimeProvider(props: {
    bindings: FourierRuntimeBindings;
    children?: ReactNode;
}): React.ReactElement;
export declare function useFourierLifecycle(callbacks: FourierLifecycle): void;
export declare function useFourierContext(): Readonly<FourierStableContext>;
export declare function useFourierTimeline(): FourierTimeline;
/** Advanced host-time bridge used by SDK-owned renderers such as FourierCanvas. */
export declare function useFourierRenderDriver(driver: FourierRenderDriver): void;
export declare function createFourierPrng(seed: number | string): FourierPrng;
//# sourceMappingURL=runtime.d.ts.map