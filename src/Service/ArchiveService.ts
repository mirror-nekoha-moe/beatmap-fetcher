import chalk from 'chalk';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { once } from 'events';
import { pipeline } from 'stream/promises';
import { ZipArchive } from 'archiver';
import { Environment } from '@Bootstrap/Environment';

// 4MB
const CHUNK_SIZE = 4 * 1024 * 1024;

export class ArchiveService {
    static async writeArchive(name: string, folder: string, beatmapsetIds: number[]): Promise<{ fileSize: number; beatmapsetCount: number } | null> {
        const entries = [];
        for (const beatmapsetId of beatmapsetIds) {
            const oszPath = await ArchiveService.findOsz(beatmapsetId);
            if (oszPath === null) {
                console.warn(chalk.yellow(`ArchiveService: no .osz for beatmapset ${beatmapsetId}, leaving it out of ${name}`));
                continue;
            }
            entries.push({
                oszPath,
                entryName: `${name}/${beatmapsetId}.osz`,
            });
        }

        if (entries.length === 0) {
            return null;
        }

        const archiveFolder = path.join(Environment.env.ARCHIVE_DIR, folder);
        await fsp.mkdir(archiveFolder, { recursive: true });

        const filePath = path.join(archiveFolder, `${name}.zip`);
        const tempPath = `${filePath}.tmp`;

        const archive = new ZipArchive({ store: true });
        const output = fs.createWriteStream(tempPath, { highWaterMark: CHUNK_SIZE });
        await Promise.all([
            pipeline(archive, output),
            ArchiveService.appendOszFiles(archive, entries),
        ]);

        await fsp.rename(tempPath, filePath);
        const stats = await fsp.stat(filePath);

        return {
            fileSize: stats.size,
            beatmapsetCount: entries.length,
        };
    }

    private static async appendOszFiles(archive: ZipArchive, entries: { oszPath: string; entryName: string }[]): Promise<void> {
        for (const entry of entries) {
            const oszStream = fs.createReadStream(entry.oszPath, { highWaterMark: CHUNK_SIZE });
            archive.append(oszStream, { name: entry.entryName });
            // only one file open at a time
            await once(oszStream, 'close');
        }
        await archive.finalize();
    }

    // a folder can have more than one .osz, take the biggest
    private static async findOsz(beatmapsetId: number): Promise<string | null> {
        const folder = path.join(Environment.env.STORAGE_DIR, String(beatmapsetId));
        const files = await fsp.readdir(folder).catch(() => [] as string[]);

        let largestPath: string | null = null;
        let largestSize = -1;
        for (const file of files) {
            if (!file.endsWith('.osz')) {
                continue;
            }
            const filePath = path.join(folder, file);
            const stats = await fsp.stat(filePath);
            if (stats.size > largestSize) {
                largestPath = filePath;
                largestSize = stats.size;
            }
        }

        return largestPath;
    }
}