import type { LoadedWorldPackage } from "./world-manifest.ts";
export declare const MAX_WORLD_ARCHIVE_BYTES: number;
export declare const MAX_WORLD_ARCHIVE_UNPACKED_BYTES: number;
export declare const MAX_WORLD_ARCHIVE_FILES = 500;
export interface WorldPackageArchive {
    readonly bytes: Uint8Array;
    readonly sha256: string;
    readonly fileCount: number;
    readonly unpackedSize: number;
}
export declare function createWorldPackageArchive(componentPackage: LoadedWorldPackage, dependencies: readonly string[]): Promise<WorldPackageArchive>;
//# sourceMappingURL=world-archive.d.ts.map