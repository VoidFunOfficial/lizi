import { type WorldPublishResult } from "./world-client.ts";
import { type ResolvedNpmPackage } from "./npm-package.ts";
import type { LoadedWorldPackage } from "./world-manifest.ts";
import { type WorldPreviewVideo } from "./world-preview.ts";
export interface PreparedWorldComponent {
    readonly componentPackage: LoadedWorldPackage;
    readonly preview: WorldPreviewVideo;
    readonly artifact: {
        readonly name: string;
        readonly kind: "react" | "motion" | "shader";
        readonly sdkAbiVersion: 1 | 1.1 | 1.2;
        readonly renderer: "dom-timeline" | "dom-timeline-ffmpeg-video";
        readonly dependencies: readonly string[];
    };
}
export interface PreparedWorldPackage {
    readonly npmPackage: ResolvedNpmPackage;
    readonly components: readonly PreparedWorldComponent[];
    cleanup(): Promise<void>;
}
export declare function prepareWorldPackage(npmUrl: string, fetcher?: typeof globalThis.fetch): Promise<PreparedWorldPackage>;
export declare function publishWorldPackage(options: {
    readonly npmUrl: string;
    readonly worldUrl: string;
    readonly token: string;
    readonly fetch?: typeof globalThis.fetch;
}): Promise<{
    readonly prepared: PreparedWorldPackage;
    readonly result: WorldPublishResult;
}>;
//# sourceMappingURL=world-publish.d.ts.map