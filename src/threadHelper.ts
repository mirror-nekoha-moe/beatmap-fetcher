import * as db from './pgDatabaseController';
import { config } from './config';
import * as beatmapController from './beatmapController';
import chalk from 'chalk';

export async function fetchHighestKnownBeatmapsetId(): Promise<number> {
    try {
        // Use scan_cursor from database instead of MAX(id)
        // This prevents recently-ranked old maps from resetting the forward scan position
        const cursor = await db.getScanCursor();
        
        if (cursor !== config.highestKnownBeatmapsetId) {
            console.log(chalk.cyan(`Updated scan cursor: ${config.highestKnownBeatmapsetId} → ${cursor}`));
            config.highestKnownBeatmapsetId = cursor;
        } else {
            console.log(chalk.gray(`Scan cursor unchanged: ${config.highestKnownBeatmapsetId}`));
        }
        return config.highestKnownBeatmapsetId;
    } catch (err) {
        console.error(chalk.red('Failed to fetch scan cursor from DB:'), err instanceof Error ? err.message : err);
        return config.highestKnownBeatmapsetId; // return last known value on error
    }
}

export async function refreshNewBeatmapsets(): Promise<void> {
    // const currentHighest = config.highestKnownBeatmapsetId || 0;
    const currentHighest = await db.getScanCursor() || 0;
    const newHighest = await beatmapController.findNextHighestBeatmapset(currentHighest);
    if (newHighest > currentHighest) {
        console.log(chalk.green(`Highest beatmapset updated: ${currentHighest} → ${newHighest}`));
        // config.highestKnownBeatmapsetId = newHighest;
        // Persist the scan cursor to database
        await db.updateScanCursor(newHighest);
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

export async function continuouslyScanRecentlyRanked(): Promise<void> {
    console.log(chalk.cyan("Starting continuous scan for recently ranked beatmapsets..."));
    
    while (true) {
        try {
            await beatmapController.scanRecentlyRankedBeatmapsets();
            
            // Check every hour for recently ranked maps
            console.log(chalk.gray("Waiting 1 hour before next recently ranked scan..."));
            await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000));
        } catch (err) {
            console.error(chalk.red('Error in recently ranked scan loop:'), err instanceof Error ? err.message : err);
            // Wait 10 minutes on error before retrying
            console.log(chalk.yellow('Waiting 10 minutes before retrying...'));
            await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
        }
    }
}