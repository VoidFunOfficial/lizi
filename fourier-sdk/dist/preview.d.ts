export { definePreview } from "./preview-config.ts";
export type { PreviewConfig } from "./types.ts";
export interface PreviewDiagnostic {
    code: string;
    message: string;
    details?: Readonly<Record<string, unknown>>;
}
export interface StartPreviewServerOptions {
    /** Artifact module or a directory containing `.tsx`/`.jsx` artifacts. */
    entryPath?: string;
    /** @deprecated Use `entryPath`. */
    configPath?: string;
    hostname?: string;
    port?: number;
    /** Also expose the preview on `0.0.0.0` with permissive CORS headers. */
    publicPort?: number;
    watch?: boolean;
}
export interface PreviewServerHandle {
    readonly url: string;
    readonly hostname: string;
    readonly port: number;
    readonly publicUrl?: string;
    readonly publicPort?: number;
    reload(): Promise<void>;
    stop(): Promise<void>;
}
export declare function defaultPreviewSourcePath(): string;
export declare function startPreviewServer(options?: StartPreviewServerOptions): Promise<PreviewServerHandle>;
//# sourceMappingURL=preview.d.ts.map