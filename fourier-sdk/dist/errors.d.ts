export declare class SdkError extends Error {
    readonly code: string;
    readonly details?: Readonly<Record<string, unknown>>;
    constructor(code: string, message: string, details?: Readonly<Record<string, unknown>>);
}
export declare function sdkFail(code: string, message: string, details?: Readonly<Record<string, unknown>>): never;
//# sourceMappingURL=errors.d.ts.map