import * as beatmapController from './beatmapController';
import * as db from './pgDatabaseController';
import * as thHelper from './threadHelper';

async function thControllerMain(): Promise<void> {
    try {
        await beatmapController.osuAuthenticate();
        setInterval(beatmapController.osuAuthenticate, 2 * 60 * 60 * 1000);
        console.log("Set osuAuthenticate() to execute every 2 hours");

        await beatmapController.readCookie();
        setInterval(beatmapController.readCookie, 3600 * 1000);
        console.log("Set readCookie() to execute once per hour.");

        await thHelper.fetchHighestKnownBeatmapsetId();
        setInterval(thHelper.fetchHighestKnownBeatmapsetId, 1800 * 1000);
        console.log("Set fetchHighestKnownBeatmapsetId() to execute once every 30min.");

        await db.updateStats();
        setInterval(db.updateStats, 300 * 1000);
        console.log("Set updateStats() to execute every 5min.");

        await beatmapController.refreshAllBeatmapsetsFromOsu();
        setInterval(beatmapController.refreshAllBeatmapsetsFromOsu, 3600 * 1000);
        console.log("Set refreshAllBeatmapsetsFromOsu() to execute once per hour.");

        thHelper.refreshNewBeatmapsets();
        setInterval(thHelper.refreshNewBeatmapsets, 3600 * 1000);
        console.log("Set refreshNewBeatmapsets() to execute once per hour.");
    } catch (err) {
        console.error("threadControllerMain encountered an error:", err instanceof Error ? err.message : err);
        process.exit(1);
    }
}

export { thControllerMain };