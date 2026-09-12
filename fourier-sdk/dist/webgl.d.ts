import { type CSSProperties, type ReactElement } from "react";
import { type FourierRenderFrame } from "./runtime.ts";
export type FourierShaderUniformType = "float" | "int" | "bool" | "vec2" | "vec3" | "vec4" | "mat3" | "mat4";
export type FourierShaderVec2 = readonly [number, number];
export type FourierShaderVec3 = readonly [number, number, number];
export type FourierShaderVec4 = readonly [number, number, number, number];
export type FourierShaderMat3 = readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
export type FourierShaderMat4 = readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
export type FourierShaderUniformLayout = Readonly<Record<string, FourierShaderUniformType>>;
type FourierShaderUniformValue<Type extends FourierShaderUniformType> = Type extends "float" ? number : Type extends "int" ? number : Type extends "bool" ? boolean : Type extends "vec2" ? FourierShaderVec2 : Type extends "vec3" ? FourierShaderVec3 : Type extends "vec4" ? FourierShaderVec4 : Type extends "mat3" ? FourierShaderMat3 : Type extends "mat4" ? FourierShaderMat4 : never;
export type FourierShaderUniformValues<Layout extends FourierShaderUniformLayout> = Readonly<{
    [Name in keyof Layout]: FourierShaderUniformValue<Layout[Name]>;
}>;
export type FourierShaderBlendMode = "replace" | "alpha" | "additive";
interface FourierShaderDefinitionBase {
    /** Optional label included in compile/link failures. */
    readonly name?: string;
    /** Defaults to a WebGL2 full-screen triangle vertex shader. */
    readonly vertexShader?: string;
    readonly fragmentShader: string;
    /** Defaults to replacing the full canvas. */
    readonly blend?: FourierShaderBlendMode;
    /** Clear before drawing. Omit when the fragment shader covers the canvas. */
    readonly clearColor?: FourierShaderVec4;
}
export type FourierShaderDefinitionInput<Layout extends FourierShaderUniformLayout = Readonly<{}>> = FourierShaderDefinitionBase & Readonly<{
    uniforms?: Layout;
}>;
export interface FourierShaderDefinition<Layout extends FourierShaderUniformLayout = FourierShaderUniformLayout> {
    readonly name?: string;
    readonly vertexShader: string;
    readonly fragmentShader: string;
    readonly uniforms: Layout;
    readonly blend: FourierShaderBlendMode;
    readonly clearColor?: FourierShaderVec4;
}
export interface FourierShaderFrame extends FourierRenderFrame {
    readonly width: number;
    readonly height: number;
    readonly seed: number;
}
export interface FourierWebGLContext {
    readonly canvas: HTMLCanvasElement;
    readonly gl: WebGL2RenderingContext;
    readonly width: number;
    readonly height: number;
    readonly seed: number;
}
export interface FourierWebGLFrame extends FourierWebGLContext, FourierRenderFrame {
}
export type FourierWebGLCleanup = () => void;
export interface FourierWebGLCanvasProps {
    readonly onCreate?: (context: Readonly<FourierWebGLContext>) => void | FourierWebGLCleanup | Promise<void | FourierWebGLCleanup>;
    readonly onFrame: (frame: Readonly<FourierWebGLFrame>) => void;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly ariaLabel?: string;
}
export type FourierShaderUniformSource<Layout extends FourierShaderUniformLayout> = FourierShaderUniformValues<Layout> | ((frame: Readonly<FourierShaderFrame>) => FourierShaderUniformValues<Layout>);
interface FourierShaderCanvasBaseProps<Layout extends FourierShaderUniformLayout> {
    readonly shader: FourierShaderDefinition<Layout>;
    /** Optional raster input exposed to GLSL as uFourierSource. */
    readonly source?: string;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly ariaLabel?: string;
}
type FourierShaderUniformProps<Layout extends FourierShaderUniformLayout> = keyof Layout extends never ? {
    readonly uniforms?: FourierShaderUniformSource<Layout>;
} : {
    readonly uniforms: FourierShaderUniformSource<Layout>;
};
export type FourierShaderCanvasProps<Layout extends FourierShaderUniformLayout> = FourierShaderCanvasBaseProps<Layout> & FourierShaderUniformProps<Layout>;
export declare const FOURIER_FULLSCREEN_VERTEX_SHADER = "\n  out vec2 vUv;\n\n  void main() {\n    vec2 position = vec2(\n      gl_VertexID == 2 ? 3.0 : -1.0,\n      gl_VertexID == 1 ? 3.0 : -1.0\n    );\n    vUv = position * 0.5 + 0.5;\n    gl_Position = vec4(position, 0.0, 1.0);\n  }\n";
/**
 * Composes GLSL snippets without changing whitespace or coercing arbitrary
 * objects. `defineFourierShader` adds the WebGL2 version and Fourier uniforms.
 */
export declare function glsl(source: string): string;
export declare function glsl(strings: TemplateStringsArray, ...values: readonly (string | number)[]): string;
export declare function defineFourierShader<const Layout extends FourierShaderUniformLayout = Readonly<{}>>(input: FourierShaderDefinitionBase & {
    readonly uniforms?: Layout;
}): FourierShaderDefinition<Readonly<Layout>>;
/** Compiles and links a Fourier shader definition for an owned WebGL2 context. */
export declare function createFourierShaderProgram(gl: WebGL2RenderingContext, definition: FourierShaderDefinition): WebGLProgram;
/**
 * Low-level WebGL2 canvas for deterministic multi-pass renderers. Fourier owns
 * the canvas, output size, context lifetime, and absolute sampling clock.
 */
export declare function FourierWebGLCanvas(props: FourierWebGLCanvasProps): ReactElement;
/**
 * Full-screen WebGL2 shader canvas sampled only by Fourier's absolute clock.
 * It owns program compilation, built-in uniforms, drawing, and GPU cleanup.
 */
export declare function FourierShaderCanvas<const Layout extends FourierShaderUniformLayout>(props: FourierShaderCanvasProps<Layout>): ReactElement;
export {};
//# sourceMappingURL=webgl.d.ts.map