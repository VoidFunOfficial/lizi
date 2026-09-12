import { type AnyArtifact, type PreviewConfig, type PreviewDefinition } from "./types.ts";
export declare function validatePreviewConfig<Artifact extends AnyArtifact>(config: PreviewDefinition<Artifact> | PreviewConfig<Artifact>): PreviewConfig<Artifact>;
export declare function definePreview<Artifact extends AnyArtifact>(config: PreviewDefinition<Artifact>): PreviewConfig<Artifact>;
export declare function resolveDesignPreview<Artifact extends AnyArtifact>(artifact: Artifact): PreviewConfig<Artifact>;
//# sourceMappingURL=preview-config.d.ts.map