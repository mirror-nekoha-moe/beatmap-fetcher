import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, `.env.${process.env.NODE_ENV}`) });

export function checkEnvVariables(): void {
    console.log("Checking Environment variables...");
    const requiredEnvVars = [
        // OSU API
        'OSU_API_V1_KEY',
        'OSU_API_CLIENT_ID',
        'OSU_API_CLIENT_SECRET',

        // PostgreSQL
        'PG_HOSTNAME',
        'PG_USERNAME',
        'PG_PASSWORD',
        'PG_DATABASE',

        // Table Names
        'TABLE_BEATMAPSET',
        'TABLE_BEATMAP',
        'TABLE_STATS',

        // Settings
        'STORAGE_DIR',
        'COOKIE_FILE'
    ];

    for (const varName of requiredEnvVars) {
        const value = process.env[varName];
        if (!value || value.trim() === '') {
            console.error(`Environment variable "${varName}" is missing or empty.`);
            process.exit(1);
        }
    }
    console.log("Environment variables all set.");
}