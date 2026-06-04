import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

import { Environment } from '@Bootstrap/Environment';
import { DownloadService } from '@Service/DownloadService';
import { BeatmapsetRepository } from '@Domain/Beatmapset/Repository/BeatmapsetRepository';
import { BaseTask } from '@Task/BaseTask';

const basePath = path.resolve(__dirname, Environment.env.STORAGE_DIR!);

/**
 * GraveyardDownloader
 * 
 * Slowly downloads graveyard, pending, and wip beatmapsets that are
 * tracked in the database but not yet downloaded.
 * 
 * Runs once per day and downloads up to GRAVEYARD_DAILY_LIMIT maps (default 400).
 * Skips qualified maps (they will become ranked or get removed anyway).
 */
export class GraveyardDownloader {
    private static readonly DAILY_LIMIT = Number(Environment.env.GRAVEYARD_DAILY_LIMIT) || 400;

    // Delay between downloads in ms - spread 400 downloads over ~24h
    // 24h = 86400s => 86400 / 400 = 216s per download (~3.6 min)
    // We use a shorter delay and just cap at the daily limit so the task finishes faster and sleeps until next run
    private static readonly DOWNLOAD_DELAY_MS = 5000; // 5 seconds between downloads

    static async downloadGraveyardMaps(): Promise<void> {
        const statuses = ['graveyard', 'pending', 'wip'];
        const rows = await BeatmapsetRepository.getUndownloadedByStatuses(statuses, this.DAILY_LIMIT);

        if (rows.length === 0) {
            console.log(chalk.gray('GraveyardDownloader: No undownloaded graveyard/pending/wip maps found.'));
            return;
        }

        console.log(chalk.cyan(`GraveyardDownloader: Found ${rows.length} maps to download (limit: ${this.DAILY_LIMIT}/day)`));

        let downloaded = 0;
        let failed = 0;

        for (const row of rows) {
            const beatmapsetId = row.id;
            const folderPath = path.join(basePath, String(beatmapsetId));

            // Double-check: skip if file already exists on disk
            const fileExistsOnDisk = fs.existsSync(folderPath) && 
                fs.readdirSync(folderPath).some(file => file.endsWith('.osz'));

            if (fileExistsOnDisk) {
                // File exists, just fix the DB state
                try {
                    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.osz'));
                    if (files.length > 0) {
                        const filePath = path.join(folderPath, files[0]);
                        const stats = fs.statSync(filePath);
                        await BeatmapsetRepository.updateDownloadState(BigInt(beatmapsetId), true, BigInt(stats.size));
                    }
                } catch (_) { /* ignore */ }
                console.log(chalk.blue(`GraveyardDownloader: Beatmapset ${beatmapsetId} already exists on disk, fixed DB state`));
                continue;
            }

            try {
                let lastErr: unknown = null;
                let success = false;

                for (let attempt = 1; attempt <= 3; attempt++) {
                    let downloadUrl: string | null = null;
                    try {
                        downloadUrl = await DownloadService.getDownloadUrl(beatmapsetId);
                        const { filePath, fileSize } = await DownloadService.downloadBeatmapset(downloadUrl, beatmapsetId);
                        await BeatmapsetRepository.updateDownloadState(BigInt(beatmapsetId), true, BigInt(fileSize));
                        downloaded++;
                        console.log(chalk.green(
                            `GraveyardDownloader: [${downloaded + failed}/${rows.length}] Downloaded beatmapset ${beatmapsetId} ` +
                            `(${(fileSize / (1024 * 1024)).toFixed(2)} MB)`
                        ));
                        success = true;
                        break;
                    } catch (dlErr) {
                        lastErr = dlErr;
                        const dlMsg = dlErr instanceof Error ? dlErr.message : String(dlErr);
                        if (dlMsg.includes('Download disabled') || dlMsg.includes('Invalid download domain')) {
                            console.log(chalk.gray(`GraveyardDownloader: Beatmapset ${beatmapsetId} download disabled, skipping`));
                            success = true; // treat as skip, not failure
                            break;
                        }
                        if (attempt < 3) {
                            console.warn(chalk.yellow(`GraveyardDownloader: Attempt ${attempt}/3 failed for beatmapset ${beatmapsetId}, retrying with fresh URL...\n  URL: ${downloadUrl ?? 'N/A'}\n  Error: ${dlMsg}`));
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }
                    }
                }

                if (!success) {
                    failed++;
                    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
                    console.warn(chalk.yellow(
                        `GraveyardDownloader: [${downloaded + failed}/${rows.length}] Failed to download beatmapset ${beatmapsetId} after 3 attempts\n` +
                        `  Error: ${msg}`
                    ));
                }
            } catch (err) {
                failed++;
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(chalk.yellow(
                    `GraveyardDownloader: Unexpected error for beatmapset ${beatmapsetId}: ${msg}`
                ));
            }

            // Delay between downloads to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, this.DOWNLOAD_DELAY_MS));
        }

        console.log(chalk.green(
            `GraveyardDownloader: Finished. Downloaded: ${downloaded}, Failed: ${failed}, Total processed: ${downloaded + failed}`
        ));
    }

    /**
     * Run once per day (1440 minutes), with 30 minute error retry delay.
     * Delayed by 24h on first start to avoid hammering cold storage on restarts.
     */
    static async run(interval: number, errorDelay: number): Promise<void> {
        const initialDelay = 24 * 60 * 60 * 1000; // 24 hours
        await BaseTask.runTask(interval * 60 * 1000, errorDelay * 60 * 1000, this.name, async () => {
            await this.downloadGraveyardMaps();
        }, initialDelay);
    }
}
