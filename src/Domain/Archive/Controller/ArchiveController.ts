import chalk from 'chalk';
import { ArchiveService } from '@Service/ArchiveService';
import { ArchiveRepository } from '@Domain/Archive/Repository/ArchiveRepository';
import { BeatmapsetRepository } from '@Domain/Beatmapset/Repository/BeatmapsetRepository';
import { Archive } from '@Domain/Archive/Model/ArchiveModel';

const ARCHIVE_MODES = [
    { name: 'std', column: 'mode_osu_count' },
    { name: 'taiko', column: 'mode_taiko_count' },
    { name: 'catch', column: 'mode_fruits_count' },
    { name: 'mania', column: 'mode_mania_count' },
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BYTES_PER_GB = 1024 * 1024 * 1024;

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

function toSizeGb(bytes: number): number {
    const sizeGb = bytes / BYTES_PER_GB;
    return Math.round(sizeGb * 100) / 100;
}

export class ArchiveController {
    // months are in UTC like osu! ranked dates
    static async buildMissingArchives(): Promise<void> {
        const firstRankedDate = await BeatmapsetRepository.getFirstRankedDate();
        if (!firstRankedDate) {
            console.log(chalk.gray('ArchiveBuilder: no ranked beatmapsets yet'));
            return;
        }

        const existing = await ArchiveRepository.getArchiveNames();
        const now = Date.now();

        let built = 0;
        let monthStart = new Date(Date.UTC(firstRankedDate.getUTCFullYear(), firstRankedDate.getUTCMonth(), 1));

        while (true) {
            const year = monthStart.getUTCFullYear();
            const month = monthStart.getUTCMonth();
            const monthEnd = new Date(Date.UTC(year, month + 1, 1));

            // wait a day so maps ranked right before midnight are in the db
            const readyAt = monthEnd.getTime() + ONE_DAY_MS;
            if (readyAt > now) {
                break;
            }

            const monthName = `${year}-${pad(month + 1)}`;
            const folder = `${year}/${pad(month + 1)}`;

            for (const mode of ARCHIVE_MODES) {
                const name = `${monthName}-${mode.name}`;
                if (existing.has(name)) {
                    continue;
                }

                const beatmapsetIds = await BeatmapsetRepository.getRankedIdsByDate(monthStart, monthEnd, mode.column);
                if (beatmapsetIds.length === 0) {
                    continue;
                }

                console.log(chalk.cyan(`ArchiveBuilder: building ${name} (${beatmapsetIds.length} beatmapsets)`));
                const archiveFile = await ArchiveService.writeArchive(name, folder, beatmapsetIds);
                if (archiveFile === null) {
                    continue;
                }

                const archive: Archive = {
                    archive_date: `${monthName}-01`,
                    mode: mode.name,
                    file_name: `${name}.zip`,
                    size_gb: toSizeGb(archiveFile.fileSize),
                    beatmapset_count: archiveFile.beatmapsetCount,
                    created_at: new Date(),
                };
                await ArchiveRepository.insertArchive(archive);
                built++;

                console.log(chalk.green(`ArchiveBuilder: ${archive.file_name} done (${archive.beatmapset_count} beatmapsets, ${archive.size_gb} GB)`));
            }

            monthStart = monthEnd;
        }

        console.log(chalk.green(`ArchiveBuilder: finished, built ${built} archives`));
    }
}