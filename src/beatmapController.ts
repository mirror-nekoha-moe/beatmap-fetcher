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

interface ModeMap {
    [key: string]: number;
}

interface StatusMap {
    [key: string]: number;
}

const modeMap: ModeMap = { 
    osu: 0,
    taiko: 1,
    fruits: 2,
    mania: 3
};

const statusMap: StatusMap = {
    graveyard: -2,
    pending: 0,
    ranked: 1,
    approved: 2,
    loved: 4
};

let osu_session = "";

export function readCookie(): void {
    try {
        osu_session = fs.readFileSync(COOKIE_FILE, "utf-8").trim();
        console.log(chalk.bgGreen("Successfully read cookie file"));
    } catch (err) {
        console.error(chalk.red("Failed to read cookie file:", err instanceof Error ? err.message : err));
    }
}

export async function getDownloadUrl(beatmapsetId: number): Promise<string> {
    if (!osu_session || typeof osu_session !== "string") {
        throw new Error("osu_session must be a non-empty string");
    }

    // Decode once if needed (sometimes %25 means double-encoded)
    let cookieValue = osu_session;
    if (cookieValue.includes("%25")) cookieValue = decodeURIComponent(cookieValue);

    const url = `https://osu.ppy.sh/beatmapsets/${beatmapsetId}/download?noVideo=1`;

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

export async function downloadBeatmapSet(url: string, beatmapsetId: number): Promise<string> {
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

    const filename = decodeURIComponent(match[1] || match[2]);
    const filePath = path.join(folderPath, filename);

    // Stream response to disk
    const fileStream = fs.createWriteStream(filePath);
    const readableStream = Readable.fromWeb(response.body as any);
    await pipeline(readableStream, fileStream);

    console.log(chalk.cyan("Downloaded:" + chalk.whiteBright(filePath)));
    return filePath;
}

export async function findNextHighestBeatmapset(currentHighestId: number): Promise<number> {
    if (!osuApiInstance) {
        await osuAuthenticate();
    }

    const step = 5000; // How many sequential IDs to check
    let newHighest = currentHighestId;
    let foundAny = false;

    console.log(chalk.bgBlue(`Searching for new beatmapsets ${currentHighestId + 1}-${currentHighestId + step}...`));

    // Check IDs sequentially
    for (let id = currentHighestId + 1; id <= currentHighestId + step; id++) {
        const beatmapset = await fetchBeatmapsetFromOsu(id);
        if (beatmapset) {
            newHighest = id;
            foundAny = true;
        }
    }

    if (!foundAny) {
        console.log(chalk.bgYellow(`No new beatmapsets found in this range.`));
    } else {
        console.log(chalk.bgBlue(`Updated highest known beatmapset ID to ${newHighest}`));
    }

    return newHighest;
}

let osuApiInstance: any = null;

export async function osuAuthenticate(): Promise<void> {
    try {
        console.log(chalk.bgBlue("Creating osu.API.createAsync..."));
        osuApiInstance = await osu.API.createAsync(
            parseInt(process.env.OSU_API_CLIENT_ID!, 10),
            process.env.OSU_API_CLIENT_SECRET!
        );
        console.log(chalk.bgGreen("osu API authenticated successfully!"));
    } catch (err) {
        console.error(chalk.red("Failed to authenticate osu API:", err instanceof Error ? err.message : err));
        throw err;
    }
}

async function processBeatmapset(rawBeatmapset: any): Promise<any> {
    // Check if we need to re-download and get current state
    const dbRow = await db.getBeatmapsetById(rawBeatmapset.id);
    let needDownload = false;

    // Check if beatmapset is deleted based on deleted_at timestamp
    const isDeleted = !!rawBeatmapset.deleted_at;
    
    // Check if download is disabled (missing audio)
    const isMissingAudio = rawBeatmapset.availability?.download_disabled === true;

    if (!dbRow) {
        // New beatmapset, needs download
        needDownload = true;
    } else {
        const apiUpdated = new Date(rawBeatmapset.last_updated || "");
        const dbUpdated = dbRow.updated ? new Date(dbRow.updated) : null;

        // Re-download if not downloaded or has updates (unless missing audio)
        if (!isMissingAudio && (!dbRow.downloaded || (dbUpdated && apiUpdated > dbUpdated))) {
            needDownload = true;
        }
    }

    const beatmapset = {
        ...rawBeatmapset,
        status: statusMap[String(rawBeatmapset.status)] ?? 0,
        osu: modeMap['osu'] ?? 0,
        taiko: modeMap['taiko'] ?? 0,
        fruits: modeMap['fruits'] ?? 0,
        mania: modeMap['mania'] ?? 0,
        deleted: isDeleted,
        downloaded: needDownload,
        missing_audio: isMissingAudio
    };
    
    // Insert or update beatmapset
    await db.insertBeatmapset(beatmapset);

    // Insert or update each beatmap individually
    if (rawBeatmapset.beatmaps && Array.isArray(rawBeatmapset.beatmaps)) {
        for (const bm of rawBeatmapset.beatmaps) {
            const mappedBeatmap = {
                ...bm,
                mode: modeMap[bm.mode_int as string] ?? 0,
                status: statusMap[bm.status as string] ?? 0
            };
            await db.insertBeatmap(mappedBeatmap);
        }
    }

    // Download if needed and not missing audio
    if (needDownload && !beatmapset.missing_audio) {
        try {
            const downloadUrl = await getDownloadUrl(rawBeatmapset.id);
            await downloadBeatmapSet(downloadUrl, rawBeatmapset.id);
            await db.markBeatmapsetDownloaded(rawBeatmapset.id, true);
        } catch (dlErr) {
            // If download fails, mark as missing_audio
            console.warn(`Download failed for beatmapset ${rawBeatmapset.id}:`, dlErr instanceof Error ? dlErr.message : dlErr);
            beatmapset.missing_audio = true;
            await db.markBeatmapsetMissingAudio(rawBeatmapset.id, true);
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
        // Wrap the API call to catch 404s silently
        const getBeatmapset = async () => {
            try {
                return await osuApiInstance.getBeatmapset(id);
            } catch (err: any) {
                if (err?.status_code === 404 || (err instanceof Error && err.message.includes('Not Found'))) {
                    return null;
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
                console.warn(`Beatmapset ${id} not found → marked as deleted in DB`);
            } else {
                console.warn(`Beatmapset ${id} not found and not in DB`);
            }
            return null;
        }

        // Only process ranked, loved, or approved maps
        const status = String(rawBeatmapset.status);
        if (status !== 'ranked' && status !== 'loved' && status !== 'approved') {
            console.log(chalk.yellow(`Skipping beatmapset ${id} (status: ${status})`));
            return null;
        }

        return await processBeatmapset(rawBeatmapset);
    } catch (err) {
        console.error(`Failed to fetch beatmapset ${id}:`, err instanceof Error ? err.message : err);
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

        console.log(`Refreshing ${ids.length} beatmapsets from osu API...`);
        
        // Process in batches of 50 (osu! API's maximum batch size)
        for (let i = 0; i < ids.length; i += 50) {
            const batchIds = ids.slice(i, i + 50);
            
            try {
                // Fetch beatmapsets with optimal concurrency for rate limit
                const concurrencyLimit = 15; // 15 requests at a time (well within 1200/min limit)
                const beatmapsets = [];
                
                // Process in chunks optimized for rate limit
                for (let j = 0; j < batchIds.length; j += concurrencyLimit) {
                    const chunk = batchIds.slice(j, j + concurrencyLimit);
                    const promises = chunk.map(id => 
                        osuApiInstance.getBeatmapset(id)
                            .catch((err: unknown) => {
                                console.warn(`Failed to fetch beatmapset ${id}:`, err instanceof Error ? err.message : err);
                                return null;
                            })
                    );

                    const results = await Promise.all(promises);
                    beatmapsets.push(...results);
                    
                    // Small delay between chunks (allows ~900 requests/min, well under limit)
                    await new Promise(resolve => setTimeout(resolve, 50));
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
                        console.warn(`Beatmapset ${id} not found → marked as deleted in DB`);
                    }
                }
            } catch (err) {
                console.error(`Failed to process batch ${Math.floor(i / 50) + 1}:`, err instanceof Error ? err.message : err);
            }
            
            console.log(`Processed batch ${Math.floor(i / 50) + 1} of ${Math.ceil(ids.length / 50)} (IDs ${batchIds[0]}-${batchIds[batchIds.length - 1]})`);
        }

        console.log("Finished refreshing all beatmapsets.");
    } catch (err) {
        console.error("Error in refreshAllBeatmapsetsFromOsu:", err instanceof Error ? err.message : err);
    }
}