import { type ReactElement, type ReactNode } from "react";
import { defineCamera, defineCameraProgram, type CameraSource, type WorldAnchor } from "./universe-core.ts";
export { defineCamera, defineCameraProgram };
export type { CameraCut, CameraDefinition, CameraDefinitionInput, CameraEase, CameraFitMode, CameraFitTarget, CameraInitial, CameraInsets, CameraMove, CameraPadding, CameraPath, CameraPathSampleContext, CameraProgramDefinition, CameraProgramInput, CameraPoseTarget, CameraSource, CameraTarget, WorldAnchor, WorldPoint, } from "./universe-core.ts";
export interface UniverseProps {
    readonly camera: CameraSource;
    /** Fraction of the camera viewport kept near-visible on every side. */
    readonly overscan?: number;
    readonly children?: ReactNode;
}
export interface WorldProps {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly anchor?: WorldAnchor;
    readonly rotation?: number;
    readonly scale?: number;
    readonly zIndex?: number;
    readonly cull?: "auto" | "never";
    readonly children?: ReactNode;
}
/**
 * Infinite logical 2D viewport. Children render normally; the SDK only adds
 * the common camera projection and host-controlled visibility animations.
 */
export declare function Universe(props: UniverseProps): ReactElement;
/** Wraps an already-rendered React subtree in one stable world transform. */
export declare function World(props: WorldProps): ReactElement;
//# sourceMappingURL=universe.d.ts.map