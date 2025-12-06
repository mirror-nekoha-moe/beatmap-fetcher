import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import chalk from 'chalk';
import * as db from './pgDatabaseController';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, `.env.development`) });

const STORAGE_DIR = 'storage/';

const pool = new Pool({
    host: process.env.PG_HOSTNAME,
    user: process.env.PG_USERNAME,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    max: 1,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 0
});

async function getMissingBeatmapsets() {
    const table = process.env.TABLE_BEATMAPSET || 'beatmapset';
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id FROM public.${table} WHERE downloaded = false ORDER BY id ASC`
        );
        return res.rows;
    } finally {
        client.release();
    }
}

// Checks if .osz file exists for a beatmapset
function fileExistsForBeatmapset(beatmapsetId: number): string | null {
    const folderPath = path.resolve(STORAGE_DIR, String(beatmapsetId));
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

async function main() {
    const missing = await getMissingBeatmapsets();
    console.log(chalk.cyan(`Found ${missing.length} missing beatmapsets`));
    let fixed = 0;
    for (const bm of missing) {
        const filePath = fileExistsForBeatmapset(bm.id);
        if (filePath) {
            await updateDbAfterDownload(bm.id, filePath);
            fixed++;
        } else {
            console.log(chalk.gray(`No file found for beatmapset ${bm.id}`));
        }
    }
    console.log(chalk.green(`Done rechecking missing maps. Fixed ${fixed} beatmapsets.`));
}

main().catch(err => {
    console.error(chalk.red('Fatal error:'), err);
    process.exit(1);
});
