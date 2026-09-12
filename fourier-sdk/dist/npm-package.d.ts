import { type LoadedWorldPackage } from "./world-manifest.ts";
export declare const MAX_NPM_PACKAGE_BYTES: number;
export declare const MAX_NPM_UNPACKED_BYTES: number;
export declare const MAX_NPM_PACKAGE_FILES = 500;
export declare const MAX_NPM_COMPONENTS = 50;
export interface NpmPackageReference {
    readonly packageUrl: string;
    readonly componentUrl?: string;
    readonly packageName: string;
    readonly namespace: string;
    readonly version: string;
    readonly componentName?: string;
}
export interface ResolvedNpmPackage {
    readonly reference: NpmPackageReference;
    readonly integrity: string;
    readonly tarballUrl: string;
    readonly fileCount: number;
    readonly unpackedSize: number;
    readonly rootDirectory: string;
    readonly components: readonly LoadedWorldPackage[];
    cleanup(): Promise<void>;
}
type Fetch = typeof globalThis.fetch;
export declare function parseNpmPackageReference(value: string): NpmPackageReference;
export declare function resolveNpmPackage(input: string, fetcher?: Fetch): Promise<ResolvedNpmPackage>;
export {};
//# sourceMappingURL=npm-package.d.ts.map