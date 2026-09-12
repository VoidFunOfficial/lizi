import { type WorldComponentType, type WorldLanguage, type WorldMood, type WorldStyle } from "./world-manifest.ts";
import type { PreparedWorldPackage } from "./world-publish.ts";
export declare const DEFAULT_FOURIER_WORLD_URL = "https://www.fourier.video";
export type WorldUserRole = "admin" | "reviewer" | "user";
export interface WorldUser {
    readonly id: string | number;
    readonly email: string;
    readonly name: string;
    readonly role: WorldUserRole;
}
export interface WorldLoginResult {
    readonly token: string;
    readonly exp?: number;
    readonly user: WorldUser;
}
export interface WorldComponentRecord {
    readonly id: string | number;
    readonly namespace: string;
    readonly name: string;
    readonly version: string;
    readonly status: "draft" | "review" | "published" | "unlisted";
}
export interface WorldPublishResult {
    readonly created: boolean;
    readonly packageId: string | number;
    readonly components: readonly WorldComponentRecord[];
}
export interface ApprovedNpmPackage {
    readonly npmPackageUrl: string;
    readonly integrity: string;
    readonly components: readonly {
        readonly name: string;
        readonly npmComponentUrl: string;
    }[];
}
export interface WorldSearchOptions {
    readonly type?: WorldComponentType;
    readonly styles?: readonly WorldStyle[];
    readonly contentDomains?: readonly string[];
    readonly moods?: readonly WorldMood[];
    readonly languages?: readonly WorldLanguage[];
    readonly license?: "MIT";
    readonly author?: string;
    readonly page?: number;
    readonly limit?: number;
    /** Groups impressions from several searches without requiring authentication. */
    readonly sessionId?: string;
    readonly signal?: AbortSignal;
}
export interface WorldSearchAuthor {
    readonly id: string | number;
    readonly name: string;
    readonly namespace: string;
    readonly bio?: string | null;
    readonly verified?: boolean | null;
    readonly avatarUrl?: string | null;
}
export interface WorldSearchMedia {
    readonly url: string;
    readonly alt: string;
    readonly mimeType?: string | null;
}
export interface WorldSearchMetrics {
    readonly viewCount: number;
    readonly clickCount: number;
    readonly favoriteCount: number;
    readonly adoptionCount: number;
    readonly qualityScore: number;
}
export interface WorldSearchMatch {
    /** Normalized hybrid score in the inclusive range 0—1. */
    readonly score: number;
    readonly reasons: readonly string[];
    readonly keywordScore: number;
    readonly semanticScore: number;
}
/** A published Fourier World component returned by semantic retrieval. */
export interface WorldSearchResult {
    readonly id: string | number;
    readonly name: string;
    readonly namespace: string;
    readonly packageName: string;
    readonly npmPackageUrl: string;
    readonly npmComponentUrl: string;
    readonly downloadable: boolean;
    readonly version: string;
    readonly type: WorldComponentType;
    readonly subtype?: string | null;
    readonly summary: string;
    readonly description: string;
    readonly instruction: string;
    readonly styles: readonly WorldStyle[];
    readonly useCases: readonly string[];
    readonly negativeUseCases: readonly string[];
    readonly aliases: readonly string[];
    readonly tags: readonly string[];
    readonly contentDomains: readonly string[];
    readonly moods: readonly WorldMood[];
    readonly languages: readonly WorldLanguage[];
    readonly license: "MIT";
    readonly author: WorldSearchAuthor | null;
    readonly cover: WorldSearchMedia | null;
    readonly preview: WorldSearchMedia | null;
    readonly metrics: WorldSearchMetrics;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly match: WorldSearchMatch;
}
export interface WorldSearchResponse {
    readonly results: readonly WorldSearchResult[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly queryId?: string | number;
    readonly latencyMs: number;
    readonly mode: "hybrid";
}
export declare class FourierWorldApiError extends Error {
    readonly status: number;
    readonly details: unknown;
    constructor(status: number, message: string, details?: unknown);
}
export declare function normalizeWorldUrl(value: string): string;
export declare class FourierWorldClient {
    readonly worldUrl: string;
    readonly token: string | undefined;
    private readonly fetcher;
    constructor(options?: {
        worldUrl?: string;
        token?: string;
        fetch?: typeof globalThis.fetch;
    });
    private fetchResponse;
    private request;
    login(email: string, password: string): Promise<WorldLoginResult>;
    currentUser(): Promise<WorldUser>;
    /**
     * Search published Fourier World capabilities by natural-language intent.
     * Fourier World performs hybrid keyword/vector retrieval and returns its
     * explainable scores; the SDK validates and freezes the public response.
     */
    search(query: string, options?: WorldSearchOptions): Promise<WorldSearchResponse>;
    publish(prepared: PreparedWorldPackage): Promise<WorldPublishResult>;
    approvedNpmPackage(npmUrl: string): Promise<ApprovedNpmPackage>;
}
//# sourceMappingURL=world-client.d.ts.map