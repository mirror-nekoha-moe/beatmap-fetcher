import chalk from 'chalk';
import fsp from 'fs/promises';
import path from 'path';

import { BeatmapsetRepository } from '@Domain/Beatmapset/Repository/BeatmapsetRepository';
import { BaseTask } from '@Task/BaseTask';

export class MissingScanner {
    static async updateDbAfterDownload(beatmapsetId: number, filePath: string) {
        try {
            const stats = await fsp.stat(filePath);
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

    static async scanMissingMaps() {
        console.log(chalk.cyan("Scanning Missing Maps..."));
        const missing = await BeatmapsetRepository.getMissingBeatmapsets();
        console.log(chalk.cyan(`Found ${missing.length} missing beatmapsets`));

        // Read the entire storage root once instead of checking each folder individually.
        // This avoids 1M+ individual stat/readdir calls on network mounts.
        const storageDir = path.resolve(String(process.env.STORAGE_DIR));
        const existingFolders = new Set(
            await fsp.readdir(storageDir).catch(() => [] as string[])
        );
        console.log(chalk.cyan(`Storage root has ${existingFolders.size} folders on disk`));

        let fixed = 0;
        for (const beatmapset of missing) {
            const idStr = String(beatmapset.id);
            if (!existingFolders.has(idStr)) continue;

            // Folder exists - check for .osz file
            const folderPath = path.join(storageDir, idStr);
            const files = await fsp.readdir(folderPath).catch(() => null);
            if (!files) continue;
            const oszFile = files.find(f => f.endsWith('.osz'));
            if (!oszFile) continue;

            const filePath = path.join(folderPath, oszFile);
            await this.updateDbAfterDownload(beatmapset.id, filePath);
            fixed++;
        }
        console.log(chalk.green(`Done rechecking missing maps. Fixed ${fixed} beatmapsets.`));
    }

    static async run(interval: number, errorDelay: number): Promise<void> {
        await BaseTask.runTask(interval*60*1000, errorDelay*60*1000, this.name, async () => {
            await this.scanMissingMaps();
        });
    }
}