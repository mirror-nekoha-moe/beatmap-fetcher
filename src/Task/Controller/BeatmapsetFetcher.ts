import chalk from 'chalk';

import { BeatmapsetController } from '@Domain/Beatmapset/Controller/BeatmapsetController';
import { StatsRepository } from '@Domain/Stats/Repository/StatsRepository';
import { BaseTask } from '@Task/BaseTask';

import { config } from 'Config';

export class BeatmapsetFetcher {
    private static async fetchHighestKnownBeatmapsetId(): Promise<number> {
        try {
            // Use scan_cursor from database instead of MAX(id)
            // This prevents recently-ranked old maps from resetting the forward scan position
            const cursor = await StatsRepository.getScanCursor();
            
            if (cursor !== config.highestKnownBeatmapsetId) {
                console.log(chalk.cyan(`Updated scan cursor: ${config.highestKnownBeatmapsetId} -> ${cursor}`));
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

    private static async refreshNewBeatmapsets(): Promise<void> {
        // const currentHighest = config.highestKnownBeatmapsetId || 0;
        const currentHighest = Number(await StatsRepository.getScanCursor() ?? 0);
        const newHighest = await BeatmapsetController.findNextHighestBeatmapset(currentHighest);

        if (newHighest > currentHighest) {
            console.log(chalk.green(`Highest beatmapset updated: ${currentHighest} -> ${newHighest}`));
            await StatsRepository.updateScanCursor(newHighest);
        } else {
            console.log(chalk.gray(`No new beatmapsets beyond ${currentHighest}`));
        }
    }
    
    static async run(interval: number, errorDelay: number): Promise<void> {
        await BaseTask.runTask(interval*60*1000, errorDelay*60*1000, this.name, async () => {
            // Update highest known ID from database
            await this.fetchHighestKnownBeatmapsetId();
            
            // Search for new beatmapsets
            await this.refreshNewBeatmapsets();
        });
    }
}