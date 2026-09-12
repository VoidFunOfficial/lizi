import type { TimeExpression } from "./project.ts";
declare const CAMERA_3D_DEFINITION: unique symbol;
export type Camera3DEase = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | readonly [number, number, number, number];
/** Camera position and Euler rotation in degrees. */
export interface Camera3DPoseInput {
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
    readonly rx?: number;
    readonly ry?: number;
    readonly rz?: number;
}
export interface Camera3DPose {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly rx: number;
    readonly ry: number;
    readonly rz: number;
}
export interface Camera3DMove {
    readonly at: TimeExpression;
    readonly duration: TimeExpression;
    readonly to: Camera3DPoseInput;
    readonly ease?: Camera3DEase;
}
export interface Camera3DInput {
    /** Perspective field of view in degrees. Defaults to 50. */
    readonly fov?: number;
    readonly initial?: Camera3DPoseInput;
    readonly moves?: readonly Camera3DMove[];
}
/** Frozen Camera3D definition produced by defineCamera3D(). */
export interface Camera3D {
    readonly fov: number;
    readonly initial: Readonly<Camera3DPose>;
    readonly moves: readonly Camera3DMove[];
    readonly [CAMERA_3D_DEFINITION]: true;
}
export interface Camera3DFrame {
    readonly frame: number;
    readonly pose: Readonly<Camera3DPose>;
    readonly matrix: string;
}
export interface World3DTransform {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly rx?: number;
    readonly ry?: number;
    readonly rz?: number;
    readonly scale?: number;
}
export declare function defineCamera3D(input: Camera3DInput): Camera3D;
export declare function isCamera3D(value: unknown): value is Camera3D;
/** Three.js camera inverse matrix serialized for a CSS 3D world plane. */
export declare function camera3DMatrix(pose: Camera3DPose): string;
/** Three.js object matrix serialized for a CSS 3D World3D node. */
export declare function world3DMatrix(transform: World3DTransform): string;
export declare function camera3DPerspective(camera: Camera3D, viewportHeight: number): number;
export declare function resolveCamera3DFrames(input: {
    readonly camera: Camera3D;
    readonly fps: number;
    readonly durationInFrames: number;
}): readonly Camera3DFrame[];
export {};
//# sourceMappingURL=universe-3d-core.d.ts.map