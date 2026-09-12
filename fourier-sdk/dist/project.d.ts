import { type ReactElement, type ReactNode } from "react";
import { type FieldDefinition, type FieldsSchema, type TimeValue } from "./schema.ts";
/** Data-only JSX project declarations consumed directly by render-engine. */
export declare const FOURIER_PROJECT_NODE: unique symbol;
export declare const FOURIER_PROJECT_DEFINITION: unique symbol;
export type TimeExpression = string | TimeValue;
export type ProjectPropValue = string | number | boolean | TimeValue;
export type TemplatePropValue = ProjectPropValue;
export type ProjectChildren = ReactNode;
interface WithChildren {
    readonly children?: ProjectChildren;
}
interface TimeNodeProps extends WithChildren {
    readonly id: string;
    readonly duration?: TimeExpression;
    readonly at?: TimeExpression;
    readonly after?: string;
    readonly with?: string;
    readonly offset?: TimeExpression;
    readonly enabled?: boolean;
    readonly preview?: boolean;
}
interface VisualProps {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly layer: number;
    readonly opacity?: number;
    readonly rotation?: number;
}
interface VisualNodeProps extends TimeNodeProps, VisualProps {
}
export interface ProjectProps extends WithChildren {
    readonly id: string;
    readonly version: "1.0";
    readonly audioSampleRate: number;
    readonly duration?: TimeExpression;
}
export interface CanvasProps {
    readonly width: number;
    readonly height: number;
    readonly fps: number;
    readonly background: string;
    readonly colorSpace: "sRGB";
}
export interface TimelineProps extends WithChildren {
}
export interface GroupProps extends Omit<TimeNodeProps, "duration"> {
    readonly mode: "parallel" | "sequence";
}
export interface VideoProps extends VisualNodeProps {
    readonly duration: TimeExpression;
    readonly src: string;
    readonly sourceIn: TimeExpression;
    readonly fit: "cover" | "contain" | "stretch";
    readonly audio: boolean;
    readonly rate?: number;
    readonly volume?: number;
    readonly loop?: boolean;
}
export interface AudioProps extends TimeNodeProps {
    readonly duration: TimeExpression;
    readonly src: string;
    readonly sourceIn: TimeExpression;
    readonly volume: number;
    readonly rate?: number;
    readonly muted?: boolean;
}
export interface ImageProps extends VisualNodeProps {
    readonly duration: TimeExpression;
    readonly src: string;
    readonly fit: "cover" | "contain" | "stretch";
}
export interface TextProps extends Omit<VisualNodeProps, "width" | "height"> {
    readonly duration?: TimeExpression;
    readonly width?: number | "auto";
    readonly height?: number | "auto";
    readonly role: "title" | "body" | "subtitle" | "label";
    readonly font: string;
    readonly fontSize: number;
    readonly lineHeight: number;
    readonly color: string;
    readonly align: "left" | "center" | "right";
    readonly verticalAlign?: "top" | "center" | "bottom";
    readonly maxLines?: number;
    readonly overflow?: "clip" | "ellipsis";
    readonly background?: string;
    readonly content: string;
    readonly tts?: {
        readonly style?: string;
        readonly volume?: number;
        readonly reference?: string;
    };
}
export interface SubtitleProps extends Omit<TextProps, "role"> {
    readonly role?: "subtitle";
}
export interface ReactLayerProps extends VisualNodeProps {
    readonly duration: TimeExpression;
    readonly component: string;
    readonly exportName?: string;
    readonly props?: Readonly<Record<string, ProjectPropValue>>;
}
export interface SceneProps extends TimeNodeProps {
    readonly src: string;
    readonly sourceIn?: TimeExpression;
    readonly sourceOut?: TimeExpression;
    readonly layer?: number;
    readonly opacity?: number;
    readonly blend?: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "addition";
    readonly audio?: boolean;
    readonly volume?: number;
    readonly overflow?: "error" | "clip" | "hold" | "loop";
}
export interface TemplateProps extends SceneProps {
    readonly props?: Readonly<Record<string, TemplatePropValue>>;
}
export interface MotionProps extends TimeNodeProps {
    readonly duration: TimeExpression;
    readonly fill: "none" | "forwards" | "backwards" | "both";
    readonly component: string;
    readonly exportName?: string;
    readonly props?: Readonly<Record<string, ProjectPropValue>>;
}
export interface ShaderProps extends TimeNodeProps {
    readonly duration: TimeExpression;
    readonly fill: "none" | "forwards" | "backwards" | "both";
    readonly component: string;
    readonly exportName?: string;
    readonly props?: Readonly<Record<string, ProjectPropValue>>;
    readonly layer: number;
}
export interface TransformKeyframe {
    readonly offset: number;
    readonly translateX: number;
    readonly translateY: number;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly rotation: number;
    readonly opacity: number;
}
export interface TransformProps extends TimeNodeProps {
    readonly duration: TimeExpression;
    readonly fill: "none" | "forwards" | "backwards" | "both";
    readonly easing: string;
    readonly keyframes: readonly TransformKeyframe[];
}
export interface ProjectNodeComponent<Props> {
    (props: Props): ReactElement | null;
    readonly [FOURIER_PROJECT_NODE]: string;
}
export declare const Project: ProjectNodeComponent<ProjectProps>;
export declare const Canvas: ProjectNodeComponent<CanvasProps>;
export declare const Timeline: ProjectNodeComponent<TimelineProps>;
export declare const Group: ProjectNodeComponent<GroupProps>;
export declare const Video: ProjectNodeComponent<VideoProps>;
export declare const Audio: ProjectNodeComponent<AudioProps>;
export declare const Image: ProjectNodeComponent<ImageProps>;
export declare const Text: ProjectNodeComponent<TextProps>;
export declare const Subtitle: ProjectNodeComponent<SubtitleProps>;
export declare const ReactLayer: ProjectNodeComponent<ReactLayerProps>;
export declare const Scene: ProjectNodeComponent<SceneProps>;
export declare const Template: ProjectNodeComponent<TemplateProps>;
export declare const Motion: ProjectNodeComponent<MotionProps>;
export declare const Shader: ProjectNodeComponent<ShaderProps>;
export declare const Transform: ProjectNodeComponent<TransformProps>;
export interface ProjectElementSnapshot {
    readonly tag: string;
    readonly props: Readonly<Record<string, unknown>>;
}
export declare function readProjectElement(value: unknown): ProjectElementSnapshot | undefined;
export interface ProjectDefinition {
    readonly package: "@fourier-video/sdk";
    readonly version: 1;
    readonly kind: "project";
    readonly declaration: ReactElement;
    readonly [FOURIER_PROJECT_DEFINITION]: true;
}
type FieldInput<Field> = Field extends FieldDefinition<any, infer Input, any> ? Input : never;
export type TemplateRenderProps<Schema extends FieldsSchema> = {
    readonly [Key in keyof Schema]: FieldInput<Schema[Key]>;
};
export interface TemplateDefinition<Schema extends FieldsSchema = FieldsSchema> {
    readonly package: "@fourier-video/sdk";
    readonly version: 1;
    readonly kind: "template";
    readonly schema: Readonly<Schema>;
    readonly render: (props: Readonly<TemplateRenderProps<Schema>>) => ReactElement;
    readonly [FOURIER_PROJECT_DEFINITION]: true;
}
export type AnyProjectDefinition = ProjectDefinition | TemplateDefinition<any>;
export interface AuthorElementWireV1 {
    readonly revision: 1;
    readonly tag: string;
    readonly props: Readonly<Record<string, unknown>>;
    readonly children: readonly AuthorElementWireV1[];
}
export interface ProjectDefinitionSnapshotV1 {
    readonly revision: 1;
    readonly kind: "project" | "template";
    readonly root: AuthorElementWireV1;
    readonly parameters: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    readonly bindings: Readonly<Record<string, TemplatePropValue>>;
    readonly bindingSources: Readonly<Record<string, "explicit" | "default">>;
}
export declare function defineProject(declaration: ReactElement): ProjectDefinition;
export declare function defineTemplate<const Schema extends FieldsSchema>(definition: {
    readonly schema: Schema;
    readonly render: (props: Readonly<TemplateRenderProps<Schema>>) => ReactElement;
}): TemplateDefinition<Schema>;
export declare function readProjectDefinition(value: unknown): AnyProjectDefinition | undefined;
export declare function bindTemplateProps(definition: TemplateDefinition<any>, input: Readonly<Record<string, unknown>>): {
    readonly props: Readonly<Record<string, TemplatePropValue>>;
    readonly sources: Readonly<Record<string, "explicit" | "default">>;
};
/**
 * Materializes Project JSX to versioned data. Callers execute this helper only
 * inside the secure Chromium project-materialize Worker.
 */
export declare function serializeProjectDefinition(definition: AnyProjectDefinition, bindings?: Readonly<Record<string, TemplatePropValue>>): ProjectDefinitionSnapshotV1;
export {};
//# sourceMappingURL=project.d.ts.map