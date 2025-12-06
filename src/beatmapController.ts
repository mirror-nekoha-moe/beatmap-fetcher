import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { Curl } from 'node-libcurl';
import * as osu from 'osu-api-v2-js';
import { Beatmapset as ApiBeatmapset } from 'osu-api-v2-js';
import * as db from './pgDatabaseController';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const basePath = path.resolve(__dirname, process.env.STORAGE_DIR!);
const COOKIE_FILE = path.resolve(__dirname, process.env.COOKIE_FILE!);

const pool = new Pool({
    host: process.env.PG_HOSTNAME,
    user: process.env.PG_USERNAME,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    max: 1000,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 0
});

enum GameMode {
    Osu = 0,
    Taiko = 1,
    Fruits = 2,
    Mania = 3
}

enum BeatmapStatus {
    Graveyard = -2,
    Pending = 0,
    Ranked = 1,
    Approved = 2,
    Loved = 4
}

const modeMap: Record<string, GameMode> = { 
    osu: GameMode.Osu,
    taiko: GameMode.Taiko,
    fruits: GameMode.Fruits,
    mania: GameMode.Mania
};

const statusMap: Record<string, BeatmapStatus> = {
    graveyard: BeatmapStatus.Graveyard,
    pending: BeatmapStatus.Pending,
    ranked: BeatmapStatus.Ranked,
    approved: BeatmapStatus.Approved,
    loved: BeatmapStatus.Loved
};

let osu_session = "";

export function readCookie(): void {
    try {
        osu_session = fs.readFileSync(COOKIE_FILE, "utf-8").trim();
        console.log(chalk.green("Successfully read cookie file"));
    } catch (err) {
        console.error(chalk.red("Failed to read cookie file:"), err instanceof Error ? err.message : err);
    }
}

export async function getDownloadUrl(beatmapsetId: number): Promise<string> {
    if (!osu_session || typeof osu_session !== "string") {
        throw new Error("osu_session must be a non-empty string");
    }

    // Decode once if needed (sometimes %25 means double-encoded)
    let cookieValue = osu_session;
    if (cookieValue.includes("%25")) cookieValue = decodeURIComponent(cookieValue);

    const url = `https://osu.ppy.sh/beatmapsets/${beatmapsetId}/download`;

    return await new Promise<string>((resolve, reject) => {
        const curl = new Curl();

        curl.setOpt("URL", url);
        curl.setOpt("FOLLOWLOCATION", true);
        curl.setOpt("COOKIE", cookieValue);
        curl.setOpt("REFERER", `https://osu.ppy.sh/beatmapsets/${beatmapsetId}`);
        curl.setOpt("HTTPHEADER", [
            "Accept: */*",
            "Connection: keep-alive",
        ]);
        curl.setOpt("SSL_VERIFYPEER", false); // optional: mimic curl -L

        curl.on("end", function (statusCode: number, body: Buffer, headers: Array<string>) {
            const finalUrl = String(this.getInfo("EFFECTIVE_URL"));
            this.close();

            if (!finalUrl || !finalUrl.startsWith("https://bm")) {
                return reject(new Error("Invalid download domain: " + finalUrl + "\n" + chalk.yellow("**(Probably Download disabled)**")));
            }
            resolve(finalUrl);
        });

        curl.on("error", function (err: Error) {
            this.close();
            reject(err);
        });

        curl.perform();
    });
}

export async function downloadBeatmapSet(url: string, beatmapsetId: number): Promise<{ filePath: string; fileSize: number }> {
    // Create the beatmapset folder
    const folderPath = path.join(basePath, String(beatmapsetId));
    fs.mkdirSync(folderPath, { recursive: true });

    // Fetch types are implicitly included in recent Node versions but let's add a type check
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to download: " + response.statusText);

    // Get filename from Content-Disposition header
    const cd = response.headers.get("content-disposition");
    if (!cd) throw new Error("Server did not provide a filename");

    const match = cd.match(/filename\*=UTF-8''(.+)|filename="(.+)"/);
    if (!match) throw new Error("Could not extract filename from headers");

    let filename = decodeURIComponent(match[1] || match[2]);
    
    // Sanitize filename: replace invalid filesystem characters
    // Replace / with ⧸ (division slash U+29F8) and \ with ⧹ (reverse solidus U+29F9)
    filename = filename.replace(/\//g, '⧸').replace(/\\/g, '⧹');
    
    const filePath = path.join(folderPath, filename);

    // Stream response to disk
    const fileStream = fs.createWriteStream(filePath);
    const readableStream = Readable.fromWeb(response.body as any);
    await pipeline(readableStream, fileStream);

    // Get file size in bytes
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    console.log(chalk.cyan(`Downloaded: ${chalk.whiteBright(filePath)} (${chalk.whiteBright((fileSize / (1024 * 1024)).toFixed(2))} MB)`));
    return { filePath, fileSize };
}

export async function findNextHighestBeatmapset(currentHighestId: number): Promise<number> {
    if (!osuApiInstance) {
        await osuAuthenticate();
    }

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
            
            const beatmapset = await fetchBeatmapsetFromOsu(id);
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

let osuApiInstance: any = null;

export async function osuAuthenticate(): Promise<void> {
    try {
        console.log(chalk.cyan("Authenticating with osu! API..."));
        osuApiInstance = await osu.API.createAsync(
            parseInt(process.env.OSU_API_CLIENT_ID!, 10),
            process.env.OSU_API_CLIENT_SECRET!
        );
        console.log(chalk.green("osu! API authenticated successfully"));
    } catch (err) {
        console.error(chalk.red("Failed to authenticate osu! API:"), err instanceof Error ? err.message : err);
        throw err;
    }
}

async function processBeatmapset(rawBeatmapset: any): Promise<any> {
    // Check if we need to re-download and get current state
    const dbRow = await db.getBeatmapsetById(rawBeatmapset.id);
    let needDownload = false;

    // Check if beatmapset is deleted based on deleted_at timestamp
    const isDeleted = !!rawBeatmapset.deleted_at;
    
    // Check if download is disabled (missing audio) from API
    const isMissingAudioFromAPI = rawBeatmapset.availability?.download_disabled === true;
    const isMissingAudioFromDB = dbRow?.missing_audio === true;

    // Check if file actually exists on disk
    const folderPath = path.join(basePath, String(rawBeatmapset.id));
    const fileExistsOnDisk = fs.existsSync(folderPath) && fs.readdirSync(folderPath).some(file => file.endsWith('.osz'));

    // Determine the correct downloaded state
    let downloadedState = dbRow?.downloaded ?? false;

    if (!dbRow) {
        // New beatmapset, needs download (unless missing audio from API)
        needDownload = !isMissingAudioFromAPI;
    } else {
        // Skip download if already marked as missing_audio in database AND API still says it's disabled
        // (If API says it's now available, we should try to download even if DB had it marked as missing)
        if (isMissingAudioFromDB && isMissingAudioFromAPI) {
            needDownload = false;
        } else if (dbRow.downloaded && fileExistsOnDisk) {
            // Already downloaded and file exists, check if there are updates
            const apiUpdated = new Date(rawBeatmapset.last_updated || "");
            const dbUpdated = dbRow.updated ? new Date(dbRow.updated) : null;

            // Only re-download if there are updates
            if (dbUpdated && apiUpdated > dbUpdated && !isMissingAudioFromAPI) {
                needDownload = true;
            }
        } else if (!dbRow.downloaded && fileExistsOnDisk) {
            // File exists on disk but DB says not downloaded - fix the DB state
            needDownload = false;
            downloadedState = true;  // Update state so insertBeatmapset() will persist it
            console.log(chalk.blue(`Fixed DB state for beatmapset ${rawBeatmapset.id} (file exists, marked as downloaded)`));
        } else {
            // Not downloaded yet or file missing, download it (unless missing audio)
            needDownload = !isMissingAudioFromAPI;
        }
    }

    const beatmapset = {
        ...rawBeatmapset,
        status: statusMap[String(rawBeatmapset.status)] ?? 0,
        osu: rawBeatmapset.beatmaps?.filter((bm: any) => bm.mode === 'osu').length ?? 0,
        taiko: rawBeatmapset.beatmaps?.filter((bm: any) => bm.mode === 'taiko').length ?? 0,
        fruits: rawBeatmapset.beatmaps?.filter((bm: any) => bm.mode === 'fruits').length ?? 0,
        mania: rawBeatmapset.beatmaps?.filter((bm: any) => bm.mode === 'mania').length ?? 0,
        deleted: isDeleted,
        downloaded: downloadedState,             // Use corrected state
        missing_audio: isMissingAudioFromAPI,    // Use API status for missing_audio
        file_size: dbRow?.file_size ?? null      // Preserve existing file_size from DB (API doesn't provide this)
    };
    
    // Insert or update beatmapset
    await db.insertBeatmapset(beatmapset);

    // Insert or update each beatmap individually
    if (rawBeatmapset.beatmaps && Array.isArray(rawBeatmapset.beatmaps)) {
        for (const bm of rawBeatmapset.beatmaps) {
            const mappedBeatmap = {
                ...bm,
                mode: modeMap[bm.mode as string] ?? 0,
                status: statusMap[bm.status as string] ?? 0,
                creator: rawBeatmapset.creator, // Add beatmapset creator to beatmap
                // Map API field names to database column names
                od: bm.accuracy,  // accuracy -> od (Overall Difficulty)
                hp: bm.drain      // drain -> hp (HP Drain)
            };
            await db.insertBeatmap(mappedBeatmap);
        }
    }

    // Download if needed and not missing audio
    if (needDownload && !beatmapset.missing_audio) {
        try {
            const downloadUrl = await getDownloadUrl(rawBeatmapset.id);
            const { filePath, fileSize } = await downloadBeatmapSet(downloadUrl, rawBeatmapset.id);
            
            // Update beatmapset with file size
            beatmapset.file_size = fileSize;
            await db.insertBeatmapset(beatmapset);
            
            await db.markBeatmapsetDownloaded(rawBeatmapset.id, true);
        } catch (dlErr) {
            // If download fails, mark as missing_audio
            console.warn(chalk.yellow(`Download failed for beatmapset ${rawBeatmapset.id}:`), dlErr instanceof Error ? dlErr.message : dlErr);
            beatmapset.missing_audio = true;
            await db.markBeatmapsetMissingAudio(rawBeatmapset.id, true);
        }
    } else if (isMissingAudioFromAPI && isMissingAudioFromDB) {
        // Skip download - API confirms audio is still unavailable
        console.log(chalk.gray(`Skipped download for beatmapset ${rawBeatmapset.id} (audio unavailable)`));
    } else if (fileExistsOnDisk && (!dbRow?.file_size || dbRow.file_size === null)) {
        // File exists but we don't have size recorded - get it from disk
        try {
            const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.osz'));
            if (files.length > 0) {
                const filePath = path.join(folderPath, files[0]);
                const stats = fs.statSync(filePath);
                beatmapset.file_size = stats.size;
                await db.insertBeatmapset(beatmapset);
                console.log(chalk.blue(`Updated file size for beatmapset ${rawBeatmapset.id}: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`));
            }
        } catch (err) {
            // Ignore errors reading file size
        }
    }

    // Always mark as not deleted since API returned it
    await db.markBeatmapsetDeleted(rawBeatmapset.id, false);

    console.log(chalk.green(`Processed beatmapset ${chalk.white(rawBeatmapset.id)} (${chalk.white(beatmapset.title)} - ${chalk.white(beatmapset.artist)})`));
    return beatmapset;
}

export async function fetchBeatmapsetFromOsu(id: number): Promise<any> {
    if (!osuApiInstance) {
        await osuAuthenticate();
    }

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
            const exists = await db.beatmapsetExists(id);
            if (exists) {
                await db.markBeatmapsetDeleted(id, true);
                console.warn(chalk.yellow(`Beatmapset ${id} not found → marked as deleted in DB`));
            } else {
                console.log(chalk.gray(`Beatmapset ${id} not found and not in DB`));
            }
            return null;
        }

        // Only process ranked, loved, or approved maps
        const status = String(rawBeatmapset.status);
        if (status !== 'ranked' && status !== 'loved' && status !== 'approved') {
            console.log(chalk.gray(`Skipping beatmapset ${id} (status: ${status})`));
            return null;
        }

        return await processBeatmapset(rawBeatmapset);
    } catch (err) {
        console.error(chalk.red(`Failed to fetch beatmapset ${id}:`), err instanceof Error ? err.message : err);
        return null;
    }
}

export async function refreshAllBeatmapsetsFromOsu(): Promise<void> {
    if (!osuApiInstance) {
        await osuAuthenticate();
    }

    try {
        // Get all beatmapset IDs from database
        const client = await pool.connect();
        const tableBeatmapset = process.env.TABLE_BEATMAPSET!;
        const res = await client.query(`SELECT id FROM public.${tableBeatmapset} ORDER BY id ASC`);
        const ids = res.rows.map(r => Number(r.id));
        client.release();

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
                        .filter((bs): bs is ApiBeatmapset => bs !== null)
                        .map(bs => [bs.id, bs])
                );

                // Process each ID in order
                for (const id of batchIds) {
                    const beatmapset = beatmapsetMap.get(id);
                    if (beatmapset) {
                        await processBeatmapset(beatmapset);
                    } else {
                        // If not in batch response, it's deleted
                        await db.markBeatmapsetDeleted(id, true);
                        console.warn(chalk.yellow(`Beatmapset ${id} not found → marked as deleted`));
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
 * Uses v1 API to get maps ranked in last 7 days by date
 */
export async function scanRecentlyRankedBeatmapsets(): Promise<void> {
    try {
        console.log(chalk.cyan("Scanning recently ranked beatmapsets (last 14 days)..."));

        const today = new Date();
        // Go back 14 days
        for (let offset = 0; offset < 14; offset++) {
            const day = new Date(today);
            day.setDate(today.getDate() - offset);
            // Format as YYYY-MM-DD 00:00:00
            const sinceDate = day.toISOString().slice(0, 10) + " 00:00:00";

            try {
                const url = `https://osu.ppy.sh/api/get_beatmaps?k=${process.env.OSU_API_V1_KEY}&since=${encodeURIComponent(sinceDate)}&limit=500`;
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(chalk.red(`v1 API returned ${response.status}: ${response.statusText}`));
                }

                const beatmaps = await response.json();
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
                    const exists = await db.beatmapsetExists(beatmapsetId);

                    if (!exists) {
                        console.log(chalk.yellow(`Found missing beatmapset: ${beatmapsetId}`));
                        await fetchBeatmapsetFromOsu(beatmapsetId);
                    }

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (err) {
                console.error(chalk.red(`Failed to scan beatmapsets for day ${sinceDate}:`), err instanceof Error ? err.message : err);
            }
        }

        console.log(chalk.green("Finished scanning recently ranked beatmapsets (last 14 days)"));
    } catch (err) {
        console.error(chalk.red("Error in scanRecentlyRankedBeatmapsets:"), err instanceof Error ? err.message : err);
    }
}