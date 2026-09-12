export declare const WORLD_COMPONENT_TYPES: readonly ["card", "motion", "shader", "graphic", "scene-template", "other"];
export declare const WORLD_STYLES: readonly ["minimal", "corporate", "editorial", "cinematic", "futuristic", "playful", "brutalist", "elegant", "social", "hand-drawn"];
export declare const WORLD_MOODS: readonly ["restrained", "serious", "energetic", "warm", "playful", "tense", "futuristic"];
export declare const WORLD_LANGUAGES: readonly ["en", "zh-CN", "zh-TW", "ja", "ko"];
export type WorldComponentType = (typeof WORLD_COMPONENT_TYPES)[number];
export type WorldStyle = (typeof WORLD_STYLES)[number];
export type WorldMood = (typeof WORLD_MOODS)[number];
export type WorldLanguage = (typeof WORLD_LANGUAGES)[number];
export interface FourierWorldManifest {
    readonly entry: string;
    readonly type: WorldComponentType;
    readonly subtype?: string;
    readonly summary: string;
    readonly instruction: string;
    readonly useCases: readonly string[];
    readonly negativeUseCases?: readonly string[];
    readonly aliases?: readonly string[];
    readonly tags: readonly string[];
    readonly style: readonly WorldStyle[];
    readonly contentDomains?: readonly string[];
    readonly mood?: readonly WorldMood[];
    readonly languages?: readonly WorldLanguage[];
}
export interface FourierWorldPackageJson {
    readonly name: string;
    readonly version: string;
    readonly description: string;
    readonly license: "MIT";
    readonly files: readonly string[];
    readonly fourier: FourierWorldManifest;
}
export interface LoadedWorldPackage {
    readonly packagePath: string;
    readonly rootDirectory: string;
    readonly entryPath: string;
    readonly namespace: string;
    readonly componentName: string;
    readonly manifest: FourierWorldPackageJson;
}
export declare class WorldManifestError extends TypeError {
    readonly issues: readonly string[];
    constructor(packagePath: string, issues: readonly string[]);
}
export declare function parseWorldPackageName(value: string): {
    readonly namespace: string;
    readonly componentName: string;
};
export declare function loadWorldPackage(inputPath?: string): Promise<LoadedWorldPackage>;
//# sourceMappingURL=world-manifest.d.ts.map