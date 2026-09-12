import { type ReactElement, type ReactNode } from "react";
import { defineCamera3D, type Camera3D } from "./universe-3d-core.ts";
export { defineCamera3D };
export type { Camera3D, Camera3DEase, Camera3DFrame, Camera3DInput, Camera3DMove, Camera3DPose, Camera3DPoseInput, } from "./universe-3d-core.ts";
export interface Universe3DProps {
    readonly camera: Camera3D;
    readonly children?: ReactNode;
}
export interface World3DAnchor {
    readonly x: number;
    readonly y: number;
}
export interface World3DProps {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly width: number;
    readonly height: number;
    readonly rx?: number;
    readonly ry?: number;
    readonly rz?: number;
    readonly scale?: number;
    readonly anchor?: World3DAnchor;
    readonly children?: ReactNode;
}
/**
 * A perspective React world whose camera matrices are calculated by Three.js
 * and sampled exclusively through Fourier's absolute timeline.
 */
export declare function Universe3D(props: Universe3DProps): ReactElement;
/** Places an existing React subtree on a fixed plane in Universe3D space. */
export declare function World3D(props: World3DProps): ReactElement;
//# sourceMappingURL=universe-3d.d.ts.map