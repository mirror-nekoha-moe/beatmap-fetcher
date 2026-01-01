import { Environment } from '@Bootstrap/Environment';

import { OsuApiService } from '@Service/OsuApiService';
import chalk from 'chalk';

async function main() {
    await Environment.initialize();

    try {
        console.log("Getting osu! API v2 instance...");
        const api = await OsuApiService.v2.getApiInstance();

        if (!api) {
            console.error("Failed to get osu! API instance");
            process.exit(1);
        }
        console.log("Successfully retrieved osu! API v2 instance");
        console.log("> " + (await api.getBeatmapset(1)).title);
    } catch (err) {
        console.error("Error while testing osu! API v2:", err instanceof Error ? err.message : err);
        process.exit(1);
    }
}

main();