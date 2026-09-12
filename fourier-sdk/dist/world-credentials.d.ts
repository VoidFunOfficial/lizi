import { type WorldLoginResult, type WorldUser } from "./world-client.ts";
export interface StoredWorldCredentials {
    readonly version: 1;
    readonly worldUrl: string;
    readonly token: string;
    readonly expiresAt?: number;
    readonly user: WorldUser;
}
export declare function worldConfigDirectory(environment?: NodeJS.ProcessEnv): string;
export declare function worldCredentialsPath(environment?: NodeJS.ProcessEnv): string;
export declare function saveWorldCredentials(worldUrl: string, login: WorldLoginResult, environment?: NodeJS.ProcessEnv): Promise<string>;
export declare function readWorldCredentials(environment?: NodeJS.ProcessEnv): Promise<StoredWorldCredentials | undefined>;
export declare function removeWorldCredentials(environment?: NodeJS.ProcessEnv): Promise<boolean>;
//# sourceMappingURL=world-credentials.d.ts.map