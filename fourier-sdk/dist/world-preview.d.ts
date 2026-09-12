import type { CompiledVisualArtifact } from "@fourier-video/core/artifact";
export declare const MAX_WORLD_PREVIEW_BYTES: number;
export interface WorldPreviewVideo {
    readonly bytes: Uint8Array;
    readonly mimeType: "video/mp4";
    readonly sha256: string;
    readonly width: number;
    readonly height: number;
    readonly fps: number;
    readonly totalFrames: number;
    readonly durationSeconds: number;
}
export declare function renderWorldPreviewVideo(artifact: CompiledVisualArtifact, options?: {
    readonly ffmpegPath?: string;
}): Promise<WorldPreviewVideo>;
//# sourceMappingURL=world-preview.d.ts.map