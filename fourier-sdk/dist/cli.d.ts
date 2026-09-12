#!/usr/bin/env bun
import { type WorldComponentType, type WorldLanguage, type WorldMood, type WorldStyle } from "./world-manifest.ts";
export interface PreviewInvocation {
    readonly command: "preview";
    readonly entryPath: string;
    readonly hostname: string;
    readonly port: number;
    readonly publicPort: number;
    readonly open: boolean;
    readonly watch: boolean;
}
export interface LoginInvocation {
    readonly command: "login";
    readonly worldUrl?: string;
    readonly email?: string;
    readonly passwordStdin: boolean;
}
export interface WhoamiInvocation {
    readonly command: "whoami";
    readonly worldUrl?: string;
}
export interface LogoutInvocation {
    readonly command: "logout";
}
export interface SearchInvocation {
    readonly command: "search";
    readonly query: string;
    readonly worldUrl?: string;
    readonly type?: WorldComponentType;
    readonly styles: readonly WorldStyle[];
    readonly contentDomains: readonly string[];
    readonly moods: readonly WorldMood[];
    readonly languages: readonly WorldLanguage[];
    readonly author?: string;
    readonly page: number;
    readonly limit: number;
    readonly sessionId?: string;
    readonly json: boolean;
}
export interface PublishInvocation {
    readonly command: "publish";
    readonly npmUrl: string;
    readonly worldUrl?: string;
    readonly dryRun: boolean;
}
export interface AddInvocation {
    readonly command: "add";
    readonly npmUrl: string;
    readonly projectDirectory: string;
    readonly componentsDirectory: string;
    readonly worldUrl?: string;
    readonly force: boolean;
}
export interface DeleteInvocation {
    readonly command: "del";
    readonly npmUrl: string;
    readonly projectDirectory: string;
    readonly purge: boolean;
}
export type CliInvocation = PreviewInvocation | LoginInvocation | WhoamiInvocation | LogoutInvocation | SearchInvocation | PublishInvocation | AddInvocation | DeleteInvocation | {
    readonly command: "help";
};
export declare function parseCliInvocation(argv: readonly string[]): CliInvocation;
export declare function runCli(argv: readonly string[]): Promise<number>;
//# sourceMappingURL=cli.d.ts.map