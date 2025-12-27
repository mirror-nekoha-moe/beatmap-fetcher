import { Pool, PoolConfig } from 'pg';
import { Environment } from '@Bootstrap/Environment';

export const DatabaseConfig: PoolConfig = {
    host: Environment.env.PG_HOSTNAME!,
    user: Environment.env.PG_USERNAME!,
    password: Environment.env.PG_PASSWORD!,
    database: Environment.env.PG_DATABASE!,
    max: parseInt(Environment.env.PG_MAX_CONN!) || 20,
    idleTimeoutMillis: parseInt(Environment.env.PG_IDLE_TIMEOUT!) || 0,
    connectionTimeoutMillis: parseInt(Environment.env.PG_CONN_TIMEOUT!) || 0,
};

export function createPool() {
    return new Pool(DatabaseConfig);
}
