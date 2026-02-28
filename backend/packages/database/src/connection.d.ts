/**
 * Database connection management with AWS Secrets Manager integration
 */
/**
 * Database credentials from Secrets Manager
 */
export interface DatabaseCredentials {
    readonly host: string;
    readonly port: number;
    readonly database: string;
    readonly username: string;
    readonly password: string;
}
/**
 * Database connection configuration
 */
export interface DatabaseConfig {
    readonly secretArn?: string;
    readonly host?: string;
    readonly port?: number;
    readonly database?: string;
    readonly username?: string;
    readonly password?: string;
    readonly ssl?: boolean;
    readonly connectionTimeoutMs?: number;
    readonly idleTimeoutMs?: number;
    readonly maxConnections?: number;
}
/**
 * Get database credentials from AWS Secrets Manager
 */
export declare function getCredentialsFromSecretsManager(secretArn: string): Promise<DatabaseCredentials>;
/**
 * Build database configuration from environment and secrets
 */
export declare function buildDatabaseConfig(config: DatabaseConfig): Promise<DatabaseCredentials & {
    ssl: boolean;
    connectionTimeoutMs: number;
    idleTimeoutMs: number;
    maxConnections: number;
}>;
/**
 * Clear cached credentials (useful for testing or credential rotation)
 */
export declare function clearCredentialsCache(): void;
/**
 * Build PostgreSQL connection string
 */
export declare function buildConnectionString(credentials: DatabaseCredentials, ssl?: boolean): string;
//# sourceMappingURL=connection.d.ts.map