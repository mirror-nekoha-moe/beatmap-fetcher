import path from 'path';
import dotenv from 'dotenv';

export class Environment {
    // Environment Object
    static env: Record<string, any> = {};
    
    public static initialize(): void {
        console.log("Loading Environment variables...");

        const nodeEnv = process.env.NODE_ENV ?? "development";
        dotenv.config({ path: path.join(__dirname, `.env.${nodeEnv}`) });

        console.log("Checking Environment variables...");
        const requiredEnvVars = [
            // osu! api v1
            'OSU_API_V1_KEY',

            // osu! api v2
            'OSU_API_CLIENT_ID',
            'OSU_API_CLIENT_SECRET',

            // PostgreSQL
            'PG_HOSTNAME',
            'PG_USERNAME',
            'PG_PASSWORD',
            'PG_DATABASE',
            'PG_MAX_CONN',
            'PG_IDLE_TIMEOUT',
            'PG_CONN_TIMEOUT',

            // Table Names
            'TABLE_BEATMAPSET',
            'TABLE_BEATMAP',
            'TABLE_STATS',

            // Settings
            'STORAGE_DIR',
            'COOKIE_FILE',
            'DEBUG_LOGGING',
            'TRACK_ALL_MAPS'
        ];
        let missingEnv = 0;
        for (const varName of requiredEnvVars) {
            const value = process.env[varName];
            if (!value || value.trim() === '') {
                console.error(`Environment variable "${varName}" is missing or empty.`);
                missingEnv++;
            }
        }
        if (missingEnv > 0) {
            process.exit(1);
        }
        console.log("Environment variables all set.");
        console.log("Building Environment Object.");

        // Build the dynamic env object from the schema
        Environment.env = Object.keys(Environment.schema).reduce((acc, key) => {
            const type = Environment.schema[key as keyof typeof Environment.schema];
            const raw = process.env[key]!;
            let value: any;

            if (type === String) value = raw;
            else if (type === Number) value = Number(raw);
            else if (type === Boolean) value = raw === "true";
            else value = raw;

            acc[key] = value;
            return acc;
        }, {} as Record<string, any>);
    }

    static schema = {
        OSU_API_V1_KEY: String,
        OSU_API_CLIENT_ID: Number,
        OSU_API_CLIENT_SECRET: String,

        PG_HOSTNAME: String,
        PG_USERNAME: String,
        PG_PASSWORD: String,
        PG_DATABASE: String,
        PG_MAX_CONN: Number,
        PG_IDLE_TIMEOUT: Number,
        PG_CONN_TIMEOUT: Number,

        TABLE_BEATMAPSET: String,
        TABLE_BEATMAP: String,
        TABLE_STATS: String,

        STORAGE_DIR: String,
        COOKIE_FILE: String,
        DEBUG_LOGGING: Boolean,
        TRACK_ALL_MAPS: Boolean,
    };
}