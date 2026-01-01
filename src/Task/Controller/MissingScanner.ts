import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

import { BeatmapsetRepository } from '@Domain/Beatmapset/Repository/BeatmapsetRepository';
import { BaseTask } from '@Task/BaseTask';

export class MissingScanner {
    static async updateDbAfterDownload(beatmapsetId: number, filePath: string) {
        try {
            const stats = fs.statSync(filePath);
            await BeatmapsetRepository.markBeatmapsetDownloaded(beatmapsetId, true);
            // Fallback: update file_size using insertBeatmapset (if available)
            if (BeatmapsetRepository.updateDownloadState) {
                await BeatmapsetRepository.updateDownloadState(BigInt(beatmapsetId), true, BigInt(stats.size));
            }
            console.log(chalk.green(`Marked downloaded and updated file size for beatmapset ${beatmapsetId}`));
        } catch (err) {
            console.error(chalk.red(`Failed to update DB for ${beatmapsetId}:`), err);
        }
    }

    private static fileExistsForBeatmapset(beatmapsetId: number): string | null {
        const folderPath = path.resolve(String(process.env.STORAGE_DIR), String(beatmapsetId));
        console.log(chalk.blue(`Checking folder: ${folderPath}`));
        if (!fs.existsSync(folderPath)) {
            console.log(chalk.yellow(`Folder does not exist: ${folderPath}`));
            return null;
        }
        const files = fs.readdirSync(folderPath);
        const fullPaths = files.map(f => path.join(folderPath, f));
        console.log(chalk.blue(`[DEBUG] Files in folder: ${JSON.stringify(fullPaths)}`));
        const oszFiles = fullPaths.filter(f => f.endsWith('.osz'));
        if (oszFiles.length === 0) {
            console.log(chalk.yellow(`No .osz files found in: ${folderPath}`));
            return null;
        }
        return oszFiles[0];
    }

    static async scanMissingMaps() {
        const missing = await BeatmapsetRepository.getMissingBeatmapsets();
        console.log(chalk.cyan(`Found ${missing.length} missing beatmapsets`));
            let fixed = 0;
            for (const beatmapset of missing) {
                const filePath = this.fileExistsForBeatmapset(beatmapset.id);
                if (filePath) {
                    await this.updateDbAfterDownload(beatmapset.id, filePath);
                    fixed++;
                } else {
                    // console.log(chalk.gray(`No file found for beatmapset ${beatmapset.id}`));
                }
            }
        console.log(chalk.green(`Done rechecking missing maps. Fixed ${fixed} beatmapsets.`));
    }

    static async run(interval: number, errorDelay: number): Promise<void> {
        await BaseTask.runTask(interval*60*1000, errorDelay*60*1000, this.name, async () => {
            await this.scanMissingMaps();
        });
    }
}