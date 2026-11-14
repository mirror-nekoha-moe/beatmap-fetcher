import chalk from 'chalk';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { ZipArchive } from 'archiver';
import { Environment } from '@Bootstrap/Environment';

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
        // the server could stream a half written file otherwise
        const tempPath = `${filePath}.tmp`;

        // .osz is already compressed
        const archive = new ZipArchive({ store: true });
        const output = fs.createWriteStream(tempPath);

        const written = new Promise<void>((resolve, reject) => {
            output.on('close', () => resolve());
            output.on('error', reject);
            archive.on('error', reject);
        });
        archive.pipe(output);

        for (const entry of entries) {
            archive.file(entry.oszPath, { name: entry.entryName });
        }

        await archive.finalize();
        await written;

        await fsp.rename(tempPath, filePath);
        const stats = await fsp.stat(filePath);

        return {
            fileSize: stats.size,
            beatmapsetCount: entries.length,
        };
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