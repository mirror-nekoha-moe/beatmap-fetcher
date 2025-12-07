import * as db from './pgDatabaseController';
import { config } from './config';
import * as beatmapController from './beatmapController';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, `.env.${process.env.NODE_ENV}`) });

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

// INTERNAL HELPER FUNCTIONS FOR MISSING SET SCANNER 
// Checks if .osz file exists for a beatmapset
function fileExistsForBeatmapset(beatmapsetId: number): string | null {
    const folderPath = path.resolve(String(process.env.STORAGE_DIR), String(beatmapsetId));
    console.log(chalk.blue(`[DEBUG] Checking folder: ${folderPath}`));
    if (!fs.existsSync(folderPath)) {
        console.log(chalk.yellow(`[DEBUG] Folder does not exist: ${folderPath}`));
        return null;
    }
    const files = fs.readdirSync(folderPath);
    const fullPaths = files.map(f => path.join(folderPath, f));
    console.log(chalk.blue(`[DEBUG] Files in folder: ${JSON.stringify(fullPaths)}`));
    const oszFiles = fullPaths.filter(f => f.endsWith('.osz'));
    if (oszFiles.length === 0) {
        console.log(chalk.yellow(`[DEBUG] No .osz files found in: ${folderPath}`));
        return null;
    }
    return oszFiles[0];
}

async function updateDbAfterDownload(beatmapsetId: number, filePath: string) {
    try {
        const stats = fs.statSync(filePath);
        await db.markBeatmapsetDownloaded(beatmapsetId, true);
        // Fallback: update file_size using insertBeatmapset (if available)
        if (db.insertBeatmapset) {
            await db.insertBeatmapset({ id: beatmapsetId, file_size: stats.size, downloaded: true });
        }
        console.log(chalk.green(`Marked downloaded and updated file size for beatmapset ${beatmapsetId}`));
    } catch (err) {
        console.error(chalk.red(`Failed to update DB for ${beatmapsetId}:`), err);
    }
}

async function scanMissingMaps() {
    const missing = await db.getMissingBeatmapsets();
    console.log(chalk.cyan(`Found ${missing.length} missing beatmapsets`));
        let fixed = 0;
        for (const beatmapset of missing) {
            const filePath = fileExistsForBeatmapset(beatmapset.id);
            if (filePath) {
                await updateDbAfterDownload(beatmapset.id, filePath);
                fixed++;
            } else {
                console.log(chalk.gray(`No file found for beatmapset ${beatmapset.id}`));
            }
        }
    console.log(chalk.green(`Done rechecking missing maps. Fixed ${fixed} beatmapsets.`));
}

export async function scanMissingMapsThreadWrapper(): Promise<void> {
    console.log(chalk.cyan("Starting to scan missing beatmapsets..."));
    
    while (true) {
        try {
            await scanMissingMaps();
            // Check every hour for missing sets
            console.log(chalk.gray("Waiting 24 hour before next missing sets scan..."));
            await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));
        } catch (err) {
            console.error(chalk.red('Error in missing sets scan loop:'), err instanceof Error ? err.message : err);
            // Wait 10 minutes on error before retrying
            console.log(chalk.yellow('Waiting 10 minutes before retrying...'));
            await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
        }
    }
}

async function scanMissingMetadata() {
    const missing = await db.getMissingMetadata();
    console.log(chalk.cyan(`Found ${missing.length} beatmapsets with missing metadata`));
        let fixed = 0;
        for (const beatmapset of missing) {
            await beatmapController.fetchBeatmapsetFromOsu(beatmapset.id);
            fixed++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    console.log(chalk.green(`Done rechecking missing metadata. Fixed ${fixed} beatmapsets.`));
}


export async function scanMissingMetadataThreadWrapper(): Promise<void> {
    console.log(chalk.cyan("Starting to scan missing metadata..."));
    
    while (true) {
        try {
            await scanMissingMetadata();
            // Check every hour for missing metadata
            console.log(chalk.gray("Waiting 24 hour before next missing metadata scan..."));
            await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));
        } catch (err) {
            console.error(chalk.red('Error in missing metadata scan loop:'), err instanceof Error ? err.message : err);
            // Wait 10 minutes on error before retrying
            console.log(chalk.yellow('Waiting 10 minutes before retrying...'));
            await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
        }
    }
}
