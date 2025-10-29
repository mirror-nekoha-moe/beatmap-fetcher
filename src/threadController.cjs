const beatmapController = require('./beatmapController.cjs');
const db = require('./pgDatabaseController.cjs');
const thHelper = require('./threadHelper.cjs');

async function thControllerMain() {
    try {
        await beatmapController.osuAuthenticate();

        await beatmapController.readCookie();
        setInterval(beatmapController.readCookie, 3600 * 1000);
        console.log("Set readCookie() to execute once per hour.");

        await thHelper.fetchHighestKnownBeatmapsetId();
        setInterval(thHelper.fetchHighestKnownBeatmapsetId, 1800 * 1000);
        console.log("Set fetchHighestKnownBeatmapsetId() to execute once every 30min.");

        await db.updateStats();
        setInterval(db.updateStats, 300 * 1000);
        console.log("Set updateStats() to execute every 5min.");

        await db.refreshAllBeatmapsetsFromOsu();
        setInterval(db.refreshAllBeatmapsetsFromOsu, 3600 * 1000);
        console.log("Set refreshAllBeatmapsetsFromOsu() to execute once per hour.");

        thHelper.refreshNewBeatmapsets();
        setInterval(thHelper.refreshNewBeatmapsets, 3600 * 1000);
        console.log("Set refreshNewBeatmapsets() to execute once per hour.");
    } catch (err) {
        console.error("threadControllerMain encountered an error:", err);
        process.exit(1);
    }
}

module.exports = { thControllerMain };