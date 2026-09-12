export declare const WORLD_PROJECT_LOCK = ".fourier-world.json";
export interface InstalledWorldComponent {
    readonly version: string;
    readonly path: string;
    readonly worldUrl: string;
    readonly npmPackageUrl: string;
    readonly npmComponentUrl: string;
    readonly integrity: string;
    readonly installedAt: string;
}
export interface WorldProjectLock {
    readonly version: 2;
    readonly components: Readonly<Record<string, InstalledWorldComponent>>;
}
export interface AddedWorldComponent {
    readonly packageName: string;
    readonly version: string;
    readonly path: string;
    readonly unchanged: boolean;
}
export interface AddWorldPackageResult {
    readonly npmPackageUrl: string;
    readonly components: readonly AddedWorldComponent[];
}
export interface DeletedWorldComponent {
    readonly packageName: string;
    readonly path: string;
    readonly trashPath?: string;
    readonly missing: boolean;
}
export interface DeleteWorldPackageResult {
    readonly npmPackageUrl: string;
    readonly components: readonly DeletedWorldComponent[];
}
export declare function addWorldComponent(options: {
    readonly npmUrl: string;
    readonly projectDirectory?: string;
    readonly componentsDirectory?: string;
    readonly worldUrl: string;
    readonly force?: boolean;
    readonly fetch?: typeof globalThis.fetch;
}): Promise<AddWorldPackageResult>;
export declare function deleteWorldComponent(options: {
    readonly npmUrl: string;
    readonly projectDirectory?: string;
    readonly purge?: boolean;
}): Promise<DeleteWorldPackageResult>;
//# sourceMappingURL=world-project.d.ts.map