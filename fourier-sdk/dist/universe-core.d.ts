import type { TimeExpression } from "./project.ts";
declare const CAMERA_DEFINITION: unique symbol;
declare const CAMERA_PROGRAM_DEFINITION: unique symbol;
export interface WorldPoint {
    readonly x: number;
    readonly y: number;
}
export interface WorldAnchor {
    readonly x: number;
    readonly y: number;
}
export interface CameraInsets {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
}
export type CameraPadding = number | CameraInsets;
export type CameraFitMode = "contain" | "cover" | "width" | "height";
export type CameraEase = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | readonly [number, number, number, number];
export interface CameraPathSampleContext {
    readonly start: WorldPoint;
    readonly end: WorldPoint;
}
export type CameraPath = {
    readonly kind: "linear";
} | {
    readonly kind: "bezier";
    readonly control1: WorldPoint;
    readonly control2: WorldPoint;
} | {
    readonly kind: "arc";
    readonly center: WorldPoint;
    readonly direction?: "shortest" | "clockwise" | "counterclockwise";
    readonly turns?: number;
} | {
    readonly kind: "curve";
    readonly points: readonly [WorldPoint, ...WorldPoint[]];
} | {
    readonly kind: "custom";
    readonly sample: (progress: number, context: Readonly<CameraPathSampleContext>) => WorldPoint;
};
export interface CameraPoseTarget {
    readonly kind: "pose";
    readonly x?: number;
    readonly y?: number;
    readonly zoom?: number;
    readonly rotation?: number;
    readonly width?: number;
    readonly height?: number;
}
export interface CameraFitTarget {
    readonly kind: "fit";
    readonly target: string;
    readonly fit: CameraFitMode;
    readonly padding?: CameraPadding;
}
export type CameraTarget = CameraPoseTarget | CameraFitTarget;
export interface CameraMove {
    readonly at: TimeExpression;
    readonly duration: TimeExpression;
    readonly to: CameraTarget;
    readonly path?: CameraPath;
    readonly ease?: CameraEase;
}
export interface CameraInitial {
    readonly x?: number;
    readonly y?: number;
    readonly zoom?: number;
    readonly rotation?: number;
}
export interface CameraDefinitionInput {
    readonly width: number;
    readonly height: number;
    readonly initial?: CameraInitial;
    readonly moves?: readonly CameraMove[];
}
export interface CameraDefinition {
    readonly width: number;
    readonly height: number;
    readonly initial: Readonly<Required<CameraInitial>>;
    readonly moves: readonly CameraMove[];
    readonly [CAMERA_DEFINITION]: true;
}
export interface CameraCut {
    readonly at: TimeExpression;
    readonly to: string;
}
export interface CameraProgramInput {
    readonly cameras: Readonly<Record<string, CameraDefinition>>;
    readonly initialCamera: string;
    readonly cuts?: readonly CameraCut[];
}
export interface CameraProgramDefinition {
    readonly cameras: Readonly<Record<string, CameraDefinition>>;
    readonly initialCamera: string;
    readonly cuts: readonly CameraCut[];
    readonly [CAMERA_PROGRAM_DEFINITION]: true;
}
export type CameraSource = CameraDefinition | CameraProgramDefinition;
export interface CameraPose {
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
    readonly rotation: number;
    readonly width: number;
    readonly height: number;
}
export interface WorldBounds {
    readonly id: string;
    readonly polygon: readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint];
    readonly cull: "auto" | "never";
    readonly element: HTMLElement;
}
export type WorldVisibility = "visible" | "near-visible" | "invisible";
export interface UniverseFrame {
    readonly frame: number;
    readonly pose: CameraPose;
    readonly matrix: string;
    /** True when this sample starts a different active Camera. */
    readonly cut?: true;
}
export declare function defineCamera(input: CameraDefinitionInput): CameraDefinition;
export declare function isCameraDefinition(value: unknown): value is CameraDefinition;
export declare function defineCameraProgram(input: CameraProgramInput): CameraProgramDefinition;
export declare function isCameraProgramDefinition(value: unknown): value is CameraProgramDefinition;
export declare function isCameraSource(value: unknown): value is CameraSource;
export declare function initialCamera(camera: CameraSource): CameraDefinition;
export declare function resolveTimeFrames(value: TimeExpression, fps: number, field: string): number;
export declare function worldPolygon(input: {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly anchor: WorldAnchor;
    readonly rotation: number;
    readonly scale: number;
}): readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint];
export declare function cameraMatrix(pose: CameraPose, viewportWidth: number, viewportHeight: number): string;
export declare function projectWorldPoint(input: WorldPoint, pose: CameraPose, viewportWidth: number, viewportHeight: number): WorldPoint;
export declare function unprojectViewportPoint(input: WorldPoint, pose: CameraPose, viewportWidth: number, viewportHeight: number): WorldPoint;
export declare function resolveUniverseFrames(input: {
    readonly camera: CameraDefinition;
    readonly worlds: ReadonlyMap<string, WorldBounds>;
    readonly fps: number;
    readonly durationInFrames: number;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
}): readonly UniverseFrame[];
export declare function resolveUniverseSourceFrames(input: {
    readonly camera: CameraSource;
    readonly worlds: ReadonlyMap<string, WorldBounds>;
    readonly fps: number;
    readonly durationInFrames: number;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
}): readonly UniverseFrame[];
export declare function classifyWorldVisibility(bounds: WorldBounds, pose: CameraPose, overscan: number): WorldVisibility;
export {};
//# sourceMappingURL=universe-core.d.ts.map