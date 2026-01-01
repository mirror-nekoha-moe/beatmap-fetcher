import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { Environment } from '@Bootstrap/Environment';
import { OsuApiService } from "@Service/OsuApiService";
import { DownloadService } from "@Service/DownloadService";
import { BeatmapsetRepository } from "@Domain/Beatmapset/Repository/BeatmapsetRepository";
import { BeatmapController } from '@Domain/Beatmap/Controller/BeatmapController';

const basePath = path.resolve(__dirname, Environment.env.STORAGE_DIR!);

export class BeatmapsetController {

    /**
    * Map Scanner
    * Used for initial scrape by incrementing set id
    */
    static async findNextHighestBeatmapset(currentHighestId: number): Promise<number> {
        let step = 10000; // How many sequential IDs to check
        let newHighest = currentHighestId;
        let foundAny = false;

        console.log(chalk.cyan(`Searching for new beatmapsets ${currentHighestId + 1}-${currentHighestId + step}...`));

        // Check IDs sequentially with delay between requests
        for (let id = currentHighestId + 1; id <= currentHighestId + step; id++) {
            try {
                // Add delay between requests (500ms)
                if (id > currentHighestId + 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const beatmapset = await this.fetchBeatmapsetFromOsu(id);
                if (beatmapset) {
                    newHighest = id;
                    foundAny = true;
                }
            } catch (err) {
                if (err instanceof Error && err.message.includes('rate limit')) {
                    console.log(chalk.yellow('Rate limit hit, waiting 60 seconds...'));
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    // Retry the same ID
                    id--;
                    continue;
                }
                throw err;
            }
        }

        if (!foundAny) {
            console.log(chalk.gray(`No new beatmapsets found in range ${currentHighestId + 1}-${currentHighestId + step}`));
        } else {
            console.log(chalk.cyan(`Updated highest known beatmapset ID to ${newHighest}`));
        }

        return newHighest;
    }
  
    static async fetchBeatmapsetFromOsu(id: number): Promise<any> {
        let osuApiInstance = await OsuApiService.v2.getApiInstance();
  
        try {
            // Wrap the API call to handle errors
            const getBeatmapset = async () => {
                try {
                    return await osuApiInstance.getBeatmapset(id);
                } catch (err: any) {
                    // Handle 404s silently
                    if (err?.status_code === 404 || (err instanceof Error && err.message.includes('Not Found'))) {
                        return null;
                    }
                    // Handle rate limits
                    if (err?.status_code === 429 || (err instanceof Error && err.message.includes('rate limit'))) {
                        console.log(chalk.yellow(`Rate limit hit when fetching beatmapset ${id}, waiting 60 seconds...`));
                        await new Promise(resolve => setTimeout(resolve, 60000));
                        // Retry after waiting
                        return await osuApiInstance.getBeatmapset(id);
                    }
                    throw err;
                }
            };

            // Use any to match Node.js behavior since types don't match actual API response
            const rawBeatmapset = await getBeatmapset() as any;

            // If API returns null → treat as deleted
            if (!rawBeatmapset) {
                const exists = await BeatmapsetRepository.beatmapsetExists(id);
                if (exists) {
                    console.warn(chalk.yellow(`Beatmapset ${id} not found, but in DB`));
                } else {
                    if (Environment.env.DEBUG_LOGGING) {
                        console.log(chalk.gray(`Beatmapset ${id} not found and not in DB`));
                    }
                }
                return null;
            }

            // Only process ranked, loved, or approved maps
            const status = String(rawBeatmapset.status);
            if (!Environment.env.TRACK_ALL_MAPS && status !== 'ranked' && status !== 'loved' && status !== 'approved') {
                if (Environment.env.DEBUG_LOGGING) {
                    console.log(chalk.gray(`Skipping beatmapset ${id} (status: ${status})`));
                }
                return null;
            }

            return await this.processBeatmapset(rawBeatmapset);
        } catch (err) {
            console.error(chalk.red(`Failed to fetch beatmapset ${id}:`), err instanceof Error ? err.message : err);
            return null;
        }
    }

    /**
    * Beatmapset processer
    */
    static async processBeatmapset(rawBeatmapset: any): Promise<any> {
        // Check if we need to re-download and get current state
        const dbRow = await BeatmapsetRepository.getBeatmapsetById(rawBeatmapset.id);

        let needDownload = false;        
        const isUnavailable =
            rawBeatmapset.deleted_at != null ||
            rawBeatmapset.availability?.download_disabled === true ||
            rawBeatmapset.availability?.more_information?.startsWith("http") === true;

        // Check if file actually exists on disk
        const folderPath = path.join(basePath, String(rawBeatmapset.id));
        const fileExistsOnDisk = fs.existsSync(folderPath) && fs.readdirSync(folderPath).some(file => file.endsWith('.osz'));

        // Determine the correct downloaded state
        let downloadedState = dbRow?.downloaded ?? false;

        if (!dbRow) {
            // New beatmapset, needs download (unless missing audio from API)
            needDownload = !isUnavailable
        } else {
            if (isUnavailable) {
                // Became DMCA or deleted later
                // NEVER:
                // - re-download
                // - flip downloaded=false            
                needDownload = false;
            } else if (dbRow.downloaded && fileExistsOnDisk) {
                // Already downloaded and file exists, check if there are updates
                const apiUpdated = new Date(rawBeatmapset.last_updated || "");
                const dbUpdated = dbRow.last_updated ? new Date(dbRow.last_updated) : null;

                // Only re-download if there are updates
                if (dbUpdated && apiUpdated > dbUpdated) {
                    needDownload = true;
                }
            } else if (!dbRow.downloaded && fileExistsOnDisk) {
                // File exists on disk but DB says not downloaded - fix the DB state
                downloadedState = true;
                needDownload = false;
                console.log(chalk.blue(`Fixed DB state for beatmapset ${rawBeatmapset.id} (file exists, marked as downloaded)`));
            } else if (!fileExistsOnDisk) {
                // Not downloaded yet or file missing, download it (unless missing audio)
                needDownload = true;
            }
        }

        // Create flatten out beatmapset object
        const beatmapset = {
            ...rawBeatmapset,
            card:           rawBeatmapset?.covers?.card ?? null,
            card_2x:        rawBeatmapset?.covers?.["card@2x"] ?? null,
            cover:          rawBeatmapset?.covers?.cover ?? null,
            cover_2x:       rawBeatmapset?.covers?.["cover@2x"] ?? null,
            list:           rawBeatmapset?.covers?.list ?? null,
            list_2x:        rawBeatmapset?.covers?.["list@2x"] ?? null,
            slimcover:      rawBeatmapset?.covers?.slimcover ?? null,
            slimcover_2x:   rawBeatmapset?.covers?.["slimcover@2x"] ?? null,

            download_disabled: rawBeatmapset.availability.download_disabled ?? null,
            more_information: rawBeatmapset.availability.more_information ?? null,

            beatmap_count:  rawBeatmapset.beatmaps?.length ?? 0,

            mode_osu_count: rawBeatmapset.beatmaps?.filter((bm: any) => bm.mode === 'osu').length ?? 0,
            mode_taiko_count: rawBeatmapset.beatmaps?.filter((bm: any) => bm.mode === 'taiko').length ?? 0,
            mode_fruits_count: rawBeatmapset.beatmaps?.filter((bm: any) => bm.mode === 'fruits').length ?? 0,
            mode_mania_count: rawBeatmapset.beatmaps?.filter((bm: any) => bm.mode === 'mania').length ?? 0,

            downloaded: downloadedState,
            file_size: dbRow?.file_size ?? null
        };
        
        // Insert or update beatmapset
        await BeatmapsetRepository.insertBeatmapset(beatmapset);

        // Insert or update each beatmap individually
        if (rawBeatmapset.beatmaps && Array.isArray(rawBeatmapset.beatmaps)) {
            await BeatmapController.processBeatmap(rawBeatmapset);
        }

        // Download if needed and not missing audio
        if (needDownload) {
            try {
                const downloadUrl = await DownloadService.getDownloadUrl(rawBeatmapset.id);
                const { filePath, fileSize } = await DownloadService.downloadBeatmapset(downloadUrl, rawBeatmapset.id);
                
                // Update beatmapset with file size
                beatmapset.file_size = fileSize;
                await BeatmapsetRepository.insertBeatmapset(beatmapset);
                
                await BeatmapsetRepository.markBeatmapsetDownloaded(rawBeatmapset.id, true);
            } catch (dlErr) {
                console.warn(
                    chalk.yellow(`Download failed for beatmapset ${rawBeatmapset.id}:`),
                    dlErr instanceof Error ? dlErr.message : dlErr
                );

                // Re-check if the file exists
                const fileStillExists = fs.existsSync(folderPath) && fs.readdirSync(folderPath).some(f => f.endsWith('.osz'));

                // If the file does not exist, mark as not downloaded
                if (!fileStillExists) {
                    downloadedState = false;
                    beatmapset.downloaded = false;
                    await BeatmapsetRepository.markBeatmapsetDownloaded(rawBeatmapset.id, false);
                }
            }        
        } else if (fileExistsOnDisk && (!dbRow?.file_size || dbRow.file_size === null)) {
            // File exists but we don't have size recorded - get it from disk
            try {
                const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.osz'));
                if (files.length > 0) {
                    const filePath = path.join(folderPath, files[0]);
                    const stats = fs.statSync(filePath);
                    beatmapset.file_size = stats.size;
                    await BeatmapsetRepository.insertBeatmapset(beatmapset);
                    console.log(chalk.blue(`Updated file size for beatmapset ${rawBeatmapset.id}: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`));
                }
            } catch (err) {
                // Ignore errors reading file size
            }
        }

        console.log(chalk.green(`Processed beatmapset ${chalk.white(rawBeatmapset.id)} (${chalk.white(beatmapset.title)} - ${chalk.white(beatmapset.artist)})`));
        return beatmapset;
    }

    /**
    * Beatmap updater
    * Fetch and process existing beatmapsets in the database
    */
    static async refreshAllBeatmapsetsFromOsu(): Promise<void> {
        let osuApiInstance = await OsuApiService.v2.getApiInstance();

        try {
            // Get all beatmapset IDs from database
            const ids = await BeatmapsetRepository.getAllBeatmapset();

            console.log(chalk.cyan(`Refreshing ${ids.length} beatmapsets from osu! API...`));
            
            // Process in batches of 50 (osu! API's maximum batch size)
            for (let i = 0; i < ids.length; i += 50) {
                const batchIds = ids.slice(i, i + 50);
                
                try {
                    // Fetch beatmapsets with safe concurrency for rate limit (1200/min = 20/sec, target 600/min = 10/sec)
                    const concurrencyLimit = 10; // 10 requests at a time
                    const beatmapsets = [];
                    
                    // Process in chunks optimized for rate limit
                    for (let j = 0; j < batchIds.length; j += concurrencyLimit) {
                        const chunk = batchIds.slice(j, j + concurrencyLimit);
                        const promises = chunk.map(id => 
                            osuApiInstance.getBeatmapset(id)
                                .catch((err: unknown) => {
                                    console.warn(chalk.yellow(`Failed to fetch beatmapset ${id}:`), err instanceof Error ? err.message : err);
                                    return null;
                                })
                        );

                        const results = await Promise.all(promises);
                        beatmapsets.push(...results);
                        
                        // Delay between chunks: 10 requests per second = 600 requests/min (50% of 1200/min limit)
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    // Create a map of successfully retrieved beatmapsets
                    const beatmapsetMap = new Map(
                        beatmapsets
                            .filter(bs => bs !== null)
                            .map(bs => [bs!.id, bs!])
                    );

                    // Process each ID in order
                    for (const id of batchIds) {
                        const beatmapset = beatmapsetMap.get(id);
                        if (beatmapset) {
                            await this.processBeatmapset(beatmapset);
                        }
                    }
                } catch (err) {
                    console.error(chalk.red(`Failed to process batch ${Math.floor(i / 50) + 1}:`), err instanceof Error ? err.message : err);
                }
                
                console.log(chalk.gray(`Processed batch ${Math.floor(i / 50) + 1}/${Math.ceil(ids.length / 50)} (IDs ${batchIds[0]}-${batchIds[batchIds.length - 1]})`));
            }

            console.log(chalk.green("Finished refreshing all beatmapsets"));
        } catch (err) {
            console.error(chalk.red("Error in refreshAllBeatmapsetsFromOsu:"), err instanceof Error ? err.message : err);
        }
    }

    /**
    * Scan recently ranked/loved beatmapsets to catch old maps that got ranked late
    * Uses v1 API to get maps ranked in last 30 days by date
    */
    static async scanRecentlyRankedBeatmapsets(): Promise<void> {
        try {
            console.log(chalk.cyan("Scanning recently ranked beatmapsets (last 30 days)..."));

            const today = new Date();
            // Go back 30 days
            for (let offset = 0; offset < 30; offset++) {
                const day = new Date(today);
                day.setDate(today.getDate() - offset);
                // Format as YYYY-MM-DD 00:00:00
                const sinceDate = day.toISOString().slice(0, 10) + " 00:00:00";

                try {
                    const beatmaps = await OsuApiService.v1.getBeatmaps(sinceDate);

                    if (!Array.isArray(beatmaps)) {
                        throw new Error("API response is not an array");
                    }
                    console.log(chalk.cyan(`Day ${sinceDate}: Found ${beatmaps.length} Beatmaps from v1 API`));

                    // Group beatmaps by beatmapset_id, only numeric IDs
                    const beatmapsetIds = new Set<number>();
                    for (const beatmap of beatmaps) {
                        const id = Number(beatmap.beatmapset_id);
                        if (Number.isFinite(id)) {
                            beatmapsetIds.add(id);
                        }
                    }

                    console.log(chalk.cyan(`Day ${sinceDate}: Found ${beatmapsetIds.size} unique beatmapsets`));

                    // Process each beatmapset
                    for (const beatmapsetId of beatmapsetIds) {
                        // Check if we already have this beatmapset
                        const exists = await BeatmapsetRepository.beatmapsetExists(beatmapsetId);

                        if (!exists) {
                            console.log(chalk.yellow(`Found missing beatmapset: ${beatmapsetId}`));
                            await this.fetchBeatmapsetFromOsu(beatmapsetId);
                        }

                        // Small delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (err) {
                    console.error(chalk.red(`Failed to scan beatmapsets for day ${sinceDate}:`), err instanceof Error ? err.message : err);
                }
            }

            console.log(chalk.green("Finished scanning recently ranked beatmapsets (last 21 days)"));
        } catch (err) {
            console.error(chalk.red("Error in scanRecentlyRankedBeatmapsets:"), err instanceof Error ? err.message : err);
        }
    }
}