import { Pool, PoolConfig } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, `.env.${process.env.NODE_ENV}`) });

export const DatabaseConfig: PoolConfig = {
    host: process.env.PG_HOSTNAME!,
    user: process.env.PG_USERNAME!,
    password: process.env.PG_PASSWORD!,
    database: process.env.PG_DATABASE!,
    max: parseInt(process.env.PG_MAX_CONN!) || 20,
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT!) || 0,
    connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT!) || 0,
};

export function createPool() {
    return new Pool(DatabaseConfig);
}
