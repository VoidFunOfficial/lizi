/** A finite vector in the deterministic Phy2D simulation space. */
export interface Phy2dVector {
    readonly x: number;
    readonly y: number;
}
export interface Phy2dParticleSnapshot extends Phy2dVector {
    readonly previousX: number;
    readonly previousY: number;
}
export interface Phy2dSoftBodySnapshot {
    readonly id: number;
    readonly center: Phy2dVector;
    readonly area: number;
    readonly restArea: number;
    readonly particles: readonly Phy2dParticleSnapshot[];
}
export interface Phy2dWorldSnapshot {
    readonly step: number;
    readonly bodies: readonly Phy2dSoftBodySnapshot[];
}
export interface Phy2dWorldOptions {
    readonly width: number;
    readonly height: number;
    readonly gravity?: Phy2dVector;
    readonly damping?: number;
    readonly solverIterations?: number;
    readonly wallPadding?: number;
}
export interface Phy2dSoftBodyOptions {
    readonly center: Phy2dVector;
    readonly radius: number;
    readonly particleCount?: number;
    readonly phase?: number;
    readonly initialVelocities?: readonly Phy2dVector[];
    readonly structuralStiffness?: number;
    readonly bendingStiffness?: number;
    readonly shapeStiffness?: number;
    readonly pressureStiffness?: number;
}
export interface Phy2dStepOptions {
    /** Uniform acceleration applied to every particle of each body by body id. */
    readonly bodyAccelerations?: readonly Phy2dVector[];
    /** Multiplier for every body's rest area; values below 1 deflate it. */
    readonly targetAreaScale?: number;
    /** Multiplier for membrane spring rest lengths; values below 1 contract it. */
    readonly targetStructureScale?: number;
    /** Point-in-polygon collision projection strength. Set to 0 to allow merging. */
    readonly collisionRelaxation?: number;
}
export interface Phy2dSoftBodyHandle {
    readonly id: number;
}
export interface Phy2dWorld {
    readonly width: number;
    readonly height: number;
    readonly bodyCount: number;
    readonly stepCount: number;
    addSoftBody(options: Phy2dSoftBodyOptions): Phy2dSoftBodyHandle;
    step(options?: Phy2dStepOptions): void;
    snapshot(): Phy2dWorldSnapshot;
}
/** Create an isolated deterministic position-based 2D soft-body world. */
export declare function createPhy2dWorld(options: Phy2dWorldOptions): Phy2dWorld;
//# sourceMappingURL=phy2d.d.ts.map