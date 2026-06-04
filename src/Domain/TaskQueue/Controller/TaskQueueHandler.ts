import chalk from 'chalk';
import fsp from 'fs/promises';
import path from 'path';
import { TaskQueueItem } from '@Domain/TaskQueue/Model/TaskQueueModel';
import { BeatmapsetController } from '@Domain/Beatmapset/Controller/BeatmapsetController';
import { BeatmapsetRepository } from '@Domain/Beatmapset/Repository/BeatmapsetRepository';
import { Environment } from '@Bootstrap/Environment';

/**
 * Registry of all tasks that can be triggered via the task queue.
 */
export class TaskQueueHandler {
    static async handle(job: TaskQueueItem): Promise<void> {
        const params = job.params ?? {};

        switch (job.task) {
            /**
             * Download all ranked/loved/approved maps that are missing their .osz file.
             * Params: none
             */
            case 'download_missing_ranked': {
                const missing = await BeatmapsetRepository.getMissingByStatuses(
                    ['ranked', 'loved', 'approved']
                );
                console.log(chalk.cyan(`[TaskQueue] download_missing_ranked: ${missing.length} maps to process`));
                for (const row of missing) {
                    await BeatmapsetController.fetchBeatmapsetFromOsu(row.id, true);
                    await new Promise(r => setTimeout(r, 200));
                }
                break;
            }

            /**
             * Force-fetch and process one or more beatmapsets from the osu! API.
             */
            case 'fetch_beatmapset': {
                let ids: number[];
                if (params.ids !== undefined) {
                    if (Array.isArray(params.ids)) {
                        ids = params.ids.map(Number).filter(Boolean);
                    } else {
                        ids = String(params.ids).split(',').map(s => Number(s.trim())).filter(Boolean);
                    }
                } else {
                    const id = Number(params.id);
                    if (!id) throw new Error('Missing param: id or ids');
                    ids = [id];
                }
                const force = params.force === true || params.force === 'true';
                console.log(chalk.cyan(`[TaskQueue] fetch_beatmapset: ${ids.length} map(s): ${ids.join(', ')}${force ? chalk.yellow(' (FORCE REDOWNLOAD)') : ''}`));
                for (const id of ids) {
                    await BeatmapsetController.fetchBeatmapsetFromOsu(id, true, force);
                    if (ids.length > 1) await new Promise(r => setTimeout(r, 200));
                }
                break;
            }

            /**
             * Run the recent ranked scanner for N days.
             */
            case 'scan_recent': {
                const days = Number(params.days) || 7;
                console.log(chalk.cyan(`[TaskQueue] scan_recent: last ${days} days`));
                await BeatmapsetController.scanRecentlyRankedBeatmapsets(days);
                break;
            }

            /**
             * Run the full filtered refresh pass.
             * Params: none
             */
            case 'refresh_all': {
                console.log(chalk.cyan(`[TaskQueue] refresh_all`));
                await BeatmapsetController.refreshAllBeatmapsetsFromOsu();
                break;
            }

            /**
             * Scan all beatmapset folders on disk and update file_size in the DB.
             * Picks the largest .osz in each folder (skips broken/empty ones).
             * Params: none
             */
            case 'sync_file_sizes': {
                const storageDir = path.resolve(String(Environment.env.STORAGE_DIR));
                console.log(chalk.cyan(`[TaskQueue] sync_file_sizes: scanning ${storageDir}`));

                const folders = await fsp.readdir(storageDir).catch(() => [] as string[]);
                let updated = 0, skipped = 0;

                for (const folder of folders) {
                    const id = Number(folder);
                    if (!id) continue;

                    const folderPath = path.join(storageDir, folder);
                    let files: string[];
                    try {
                        files = await fsp.readdir(folderPath);
                    } catch {
                        skipped++;
                        continue;
                    }

                    const oszFiles = files.filter(f => f.endsWith('.osz'));
                    if (oszFiles.length === 0) { skipped++; continue; }

                    // Pick the largest .osz (most complete file)
                    let bestFile: string | null = null;
                    let bestSize = -1n;
                    for (const f of oszFiles) {
                        try {
                            const st = await fsp.stat(path.join(folderPath, f));
                            if (BigInt(st.size) > bestSize) {
                                bestSize = BigInt(st.size);
                                bestFile = f;
                            }
                        } catch { /* ignore */ }
                    }

                    if (!bestFile || bestSize <= 0n) { skipped++; continue; }

                    await BeatmapsetRepository.updateDownloadState(BigInt(id), true, bestSize);
                    updated++;

                    if (updated % 1000 === 0) {
                        console.log(chalk.cyan(`[TaskQueue] sync_file_sizes: ${updated} updated so far...`));
                    }
                }

                console.log(chalk.green(`[TaskQueue] sync_file_sizes done: ${updated} updated, ${skipped} skipped`));
                break;
            }

            default:
                throw new Error(`Unknown task: "${job.task}"`);
        }
    }
}
