export class Environment {    
    static check(): void {
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

        for (const varName of requiredEnvVars) {
            const value = process.env[varName];
            if (!value || value.trim() === '') {
                console.error(`Environment variable "${varName}" is missing or empty.`);
                process.exit(1);
            }
        }
        console.log("Environment variables all set.");
    }
}
