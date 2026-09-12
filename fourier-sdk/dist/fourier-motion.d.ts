import React, { type CSSProperties, type JSX, type ReactElement, type ReactNode } from "react";
type TransformValue = string | number;
/** One deterministic CSS keyframe on the host-controlled Fourier timeline. */
export type FourierMotionTarget = Omit<CSSProperties, "offset" | "transform" | "translate" | "rotate" | "scale"> & {
    /** Motion-style transform shortcuts. Numeric translation values use px. */
    x?: TransformValue;
    y?: TransformValue;
    z?: TransformValue;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    rotate?: TransformValue;
    rotateX?: TransformValue;
    rotateY?: TransformValue;
    skewX?: TransformValue;
    skewY?: TransformValue;
    transform?: string;
    offset?: number;
    easing?: string;
} & {
    [Property in `--${string}`]?: string | number;
};
export interface FourierMotionTransition {
    /** Seconds, matching the familiar Motion authoring convention. Defaults to host duration. */
    duration?: number;
    /** Seconds. Negative delay is allowed by the underlying Fourier timeline. */
    delay?: number;
    /** CSS easing or cubic-bezier control points. */
    ease?: string | readonly [number, number, number, number];
    /** Additional play count after the first iteration. Must be finite. */
    repeat?: number;
    repeatType?: "loop" | "reverse";
    fill?: FillMode;
}
export interface FourierMotionRootProps {
    children?: ReactNode;
}
type MotionElementProps<Tag extends keyof JSX.IntrinsicElements> = Omit<JSX.IntrinsicElements[Tag], "ref" | "initial" | "animate" | "transition"> & {
    /** Initial visual state. Pass false to animate from the element's authored CSS. */
    initial?: FourierMotionTarget | false;
    /** End state or an explicit ordered keyframe sequence. */
    animate: FourierMotionTarget | readonly FourierMotionTarget[];
    transition?: FourierMotionTransition;
};
type IntrinsicElement<Tag extends keyof JSX.IntrinsicElements> = Tag extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[Tag] : Tag extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[Tag] : Element;
export type FourierMotionComponent<Tag extends keyof JSX.IntrinsicElements> = React.ForwardRefExoticComponent<React.PropsWithoutRef<MotionElementProps<Tag>> & React.RefAttributes<IntrinsicElement<Tag>>>;
export type FourierMotionElements = {
    readonly [Tag in keyof JSX.IntrinsicElements]: FourierMotionComponent<Tag>;
};
export interface FourierMotionFactory {
    create<Tag extends keyof JSX.IntrinsicElements>(tag: Tag): FourierMotionComponent<Tag>;
}
/**
 * Registers the single lifecycle required by a Fourier Motion artifact.
 * Place exactly one root around any number of motion.* elements.
 */
export declare function FourierMotion({ children }: FourierMotionRootProps): ReactElement;
/** Motion-style intrinsic elements backed only by the Fourier SDK timeline. */
export declare const motion: FourierMotionFactory & FourierMotionElements;
export {};
//# sourceMappingURL=fourier-motion.d.ts.map