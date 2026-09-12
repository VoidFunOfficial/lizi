import { type CSSProperties, type ReactElement, type RefObject } from "react";
import { Camera, Mesh, Scene, TextureLoader as ThreeTextureLoader, WebGLRenderer, type ColorSpace, type LoadingManager, type Texture, type WebGLRendererParameters } from "three";
import { type FourierRenderFrame } from "./runtime.ts";
import type { FourierVideoHandle } from "./types.ts";
export * from "./react.ts";
export * from "three";
export { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
export type { GLTF } from "three/addons/loaders/GLTFLoader.js";
export type FourierTextureSource = string | URL | Readonly<{
    src: string;
}>;
export interface FourierTextureLoaderOptions {
    /** Optional output color space applied after every successful decode. */
    readonly colorSpace?: ColorSpace;
    /** Optional vertical orientation applied after every successful decode. */
    readonly flipY?: boolean;
}
/** Normalizes bundled asset imports, URLs, and image-like `{ src }` values. */
export declare function resolveFourierTextureSource(source: FourierTextureSource): string;
/**
 * Fourier-aware drop-in TextureLoader.
 *
 * It accepts normal bundled asset strings, URL objects, and image-like `{ src }`
 * values, preserves Three.js loading-manager behavior, and reports useful decode
 * errors instead of the browser's opaque `[object Event]`.
 */
export declare class FourierTextureLoader extends ThreeTextureLoader {
    readonly options: FourierTextureLoaderOptions;
    constructor(manager?: LoadingManager, options?: FourierTextureLoaderOptions);
    load(source: FourierTextureSource, onLoad?: (texture: Texture<HTMLImageElement>) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void): Texture<HTMLImageElement>;
    loadAsync(source: FourierTextureSource, onProgress?: (event: ProgressEvent) => void): Promise<Texture<HTMLImageElement>>;
    loadManyAsync(sources: readonly FourierTextureSource[], onProgress?: (event: ProgressEvent) => void): Promise<readonly Texture<HTMLImageElement>[]>;
}
/** The SDK Three.js entry replaces Three's loader with the Fourier-aware loader. */
export { FourierTextureLoader as TextureLoader };
export interface FourierThreeContext {
    readonly canvas: HTMLCanvasElement;
    readonly renderer: WebGLRenderer;
    readonly scene: Scene;
    readonly camera: Camera;
    readonly width: number;
    readonly height: number;
}
export interface FourierThreeFrame extends FourierThreeContext, FourierRenderFrame {
}
export type FourierThreeCleanup = () => void;
export interface FourierVideoSurfaceBinding {
    readonly video: Readonly<FourierVideoHandle>;
    readonly meshRef: RefObject<Mesh | null>;
    /** Rounded-corner radius divided by the shorter video edge. */
    readonly cornerRadiusRatio?: number;
}
export interface FourierCanvasProps {
    /** Defaults to a new empty Scene. */
    scene?: Scene;
    /** Defaults to a 45° PerspectiveCamera at z=5. */
    camera?: Camera;
    /** `canvas`, pixel ratio, and output size remain Fourier-owned. */
    rendererOptions?: Omit<WebGLRendererParameters, "canvas">;
    /** May asynchronously load local assets bundled with the artifact. */
    onCreate?(context: Readonly<FourierThreeContext>): void | FourierThreeCleanup | Promise<void | FourierThreeCleanup>;
    /** Runs synchronously for every absolute time selected by the Fourier host. */
    onFrame?(frame: Readonly<FourierThreeFrame>): void;
    /** Optional Three.js plane populated later by FFmpeg instead of the browser. */
    videoSurface?: FourierVideoSurfaceBinding;
    className?: string;
    style?: CSSProperties;
    ariaLabel?: string;
}
/**
 * React-owned Three.js canvas driven exclusively by Fourier's absolute clock.
 * It deliberately does not start requestAnimationFrame or a Three animation loop.
 */
export declare function FourierCanvas(props: FourierCanvasProps): ReactElement;
//# sourceMappingURL=three.d.ts.map