const { readCookie } = require('./beatmapController.cjs');
const db = require('./pgDatabaseController.cjs');
const config = require('./config.cjs');

const pool = new Pool({
  host: process.env.PG_HOSTNAME,
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  max: 1000,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 0
});


async function fetchHighestKnownBeatmapsetId() {
    try {
        const idRaw = await db.getHighestBeatmapsetId();
        const id = Number(idRaw) || 0; // coerce possible string/bigint to number
        if (!Number.isFinite(id)) {
            console.warn('Received non-numeric highest beatmapset id from DB:', idRaw);
            return config.highestKnownBeatmapsetId;
        }

        if (id !== config.highestKnownBeatmapsetId) {
            console.log(`Updated highestKnownBeatmapsetId: ${config.highestKnownBeatmapsetId} -> ${id}`);
            config.highestKnownBeatmapsetId = id;
        } else {
            console.log(`highestKnownBeatmapsetId unchanged: ${config.highestKnownBeatmapsetId}`);
        }
        return config.highestKnownBeatmapsetId;
    } catch (err) {
        console.error('Failed to fetch highest beatmapset id from DB:', err);
        return config.highestKnownBeatmapsetId; // return last known value on error
    }
}

async function thControllerMain() {
    readCookie();
    setInterval(readCookie, 3600 * 1000);
    console.log("Set readCookie() to execute once per hour.");

    fetchHighestKnownBeatmapsetId();
    setInterval(fetchHighestKnownBeatmapsetId, 3600 * 1000);
    console.log("Set fetchHighestKnownBeatmapsetId() to execute once per hour.");

    db.updateStats();
    setInterval(db.updateStats, 3600 * 1000);
    console.log("Set updateStats() to execute once per hour.");
}


module.exports = { thControllerMain };