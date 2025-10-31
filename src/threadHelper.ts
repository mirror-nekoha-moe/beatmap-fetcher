import * as db from './pgDatabaseController';
import { config } from './config';
import * as beatmapController from './beatmapController';
import chalk from 'chalk';

export async function fetchHighestKnownBeatmapsetId(): Promise<number> {
    try {
        const idRaw = await db.getHighestBeatmapsetId();
        const id = Number(idRaw) || 0; // coerce possible string/bigint to number
        if (!Number.isFinite(id)) {
            console.warn(chalk.yellow('Received non-numeric highest beatmapset id from DB:'), idRaw);
            return config.highestKnownBeatmapsetId;
        }

        if (id !== config.highestKnownBeatmapsetId) {
            console.log(chalk.cyan(`Updated highestKnownBeatmapsetId: ${config.highestKnownBeatmapsetId} → ${id}`));
            config.highestKnownBeatmapsetId = id;
        } else {
            console.log(chalk.gray(`highestKnownBeatmapsetId unchanged: ${config.highestKnownBeatmapsetId}`));
        }
        return config.highestKnownBeatmapsetId;
    } catch (err) {
        console.error(chalk.red('Failed to fetch highest beatmapset id from DB:'), err instanceof Error ? err.message : err);
        return config.highestKnownBeatmapsetId; // return last known value on error
    }
}

export async function refreshNewBeatmapsets(): Promise<void> {
    const currentHighest = config.highestKnownBeatmapsetId || 0;
    const newHighest = await beatmapController.findNextHighestBeatmapset(currentHighest);
    if (newHighest > currentHighest) {
        console.log(chalk.green(`Highest beatmapset updated: ${currentHighest} → ${newHighest}`));
        config.highestKnownBeatmapsetId = newHighest;
    } else {
        console.log(chalk.gray(`No new beatmapsets beyond ${currentHighest}`));
    }
}

export async function continuouslyFetchNewBeatmapsets(): Promise<void> {
    console.log(chalk.cyan("Starting continuous beatmapset fetching loop..."));
    
    while (true) {
        try {
            // Update highest known ID from database
            await fetchHighestKnownBeatmapsetId();
            
            // Search for new beatmapsets
            await refreshNewBeatmapsets();
            
            // Wait a bit before next iteration (e.g., 5 minutes)
            await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        } catch (err) {
            console.error(chalk.red('Error in continuous fetch loop:'), err instanceof Error ? err.message : err);
            // Wait longer on error before retrying (10 minutes)
            console.log(chalk.yellow('Waiting 10 minutes before retrying...'));
            await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
        }
    }
}

export async function continuouslyRefreshAllBeatmapsets(): Promise<void> {
    console.log(chalk.cyan("Starting continuous refresh loop for all beatmapsets..."));
    
    while (true) {
        try {
            console.log(chalk.cyan("Starting full refresh of all beatmapsets..."));
            await beatmapController.refreshAllBeatmapsetsFromOsu();
            console.log(chalk.green("Completed full refresh. Starting next iteration immediately..."));
            
            // No delay - immediately start next refresh cycle
            // This ensures the database is always as up-to-date as possible
        } catch (err) {
            console.error(chalk.red('Error in continuous refresh loop:'), err instanceof Error ? err.message : err);
            // Wait 30 minutes on error before retrying
            console.log(chalk.yellow("Waiting 30 minutes before retrying..."));
            await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
        }
    }
}