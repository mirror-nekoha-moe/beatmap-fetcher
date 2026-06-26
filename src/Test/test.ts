import { Environment } from '@Bootstrap/Environment';
import fs from 'fs';
import { OsuApiService } from '@Service/OsuApiService';

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

        const events = await api.getBeatmapsetEvents();
        const jsonString = JSON.stringify(events, null, 2);

        fs.writeFileSync('beatmapsetEvents.json', jsonString);
        console.log(`Saved events to beatmapsetEvents.json`);
    } catch (err) {
        console.error("Error while testing osu! API v2:", err instanceof Error ? err.message : err);
        process.exit(1);
    }
}
main();
