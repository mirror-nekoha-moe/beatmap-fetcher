import * as db from './pgDatabaseController';
import { config } from './config';
import * as beatmapController from './beatmapController';

export async function fetchHighestKnownBeatmapsetId(): Promise<number> {
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
        console.error('Failed to fetch highest beatmapset id from DB:', err instanceof Error ? err.message : err);
        return config.highestKnownBeatmapsetId; // return last known value on error
    }
}

export async function refreshNewBeatmapsets(): Promise<void> {
    const currentHighest = config.highestKnownBeatmapsetId || 0;
    const newHighest = await beatmapController.findNextHighestBeatmapset(currentHighest);
    if (newHighest > currentHighest) {
        console.log(`Highest beatmapset updated: ${currentHighest} -> ${newHighest}`);
        config.highestKnownBeatmapsetId = newHighest;
    } else {
        console.log(`No new beatmapsets beyond ${currentHighest}`);
    }
}