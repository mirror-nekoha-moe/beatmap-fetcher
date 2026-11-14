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

const ARCHIVES_AT_ONCE = 4;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BYTES_PER_GB = 1024 * 1024 * 1024;

interface ArchiveJob {
    name: string;
    folder: string;
    archiveDate: string;
    mode: { name: string; column: string };
    monthStart: Date;
    monthEnd: Date;
}

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

        const jobs: ArchiveJob[] = [];
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
                jobs.push({
                    name,
                    folder,
                    archiveDate: `${monthName}-01`,
                    mode,
                    monthStart,
                    monthEnd,
                });
            }

            monthStart = monthEnd;
        }

        const workers = [];
        for (let i = 0; i < ARCHIVES_AT_ONCE; i++) {
            workers.push(ArchiveController.buildJobs(jobs));
        }
        const builtPerWorker = await Promise.all(workers);

        let built = 0;
        for (const count of builtPerWorker) {
            built += count;
        }
        console.log(chalk.green(`ArchiveBuilder: finished, built ${built} archives`));
    }

    // workers share the jobs list
    private static async buildJobs(jobs: ArchiveJob[]): Promise<number> {
        let built = 0;
        while (jobs.length > 0) {
            const job = jobs.shift()!;
            try {
                const wasBuilt = await ArchiveController.buildArchive(job);
                if (wasBuilt) {
                    built++;
                }
            } catch (err) {
                console.error(chalk.red(`ArchiveBuilder: ${job.name} failed:`), err instanceof Error ? err.message : err);
            }
        }
        return built;
    }

    private static async buildArchive(job: ArchiveJob): Promise<boolean> {
        const beatmapsetIds = await BeatmapsetRepository.getRankedIdsByDate(job.monthStart, job.monthEnd, job.mode.column);
        if (beatmapsetIds.length === 0) {
            return false;
        }

        console.log(chalk.cyan(`ArchiveBuilder: building ${job.name} (${beatmapsetIds.length} beatmapsets)`));
        const archiveFile = await ArchiveService.writeArchive(job.name, job.folder, beatmapsetIds);
        if (archiveFile === null) {
            return false;
        }

        const archive: Archive = {
            archive_date: job.archiveDate,
            mode: job.mode.name,
            file_name: `${job.name}.zip`,
            size_gb: toSizeGb(archiveFile.fileSize),
            beatmapset_count: archiveFile.beatmapsetCount,
            created_at: new Date(),
        };
        await ArchiveRepository.insertArchive(archive);

        console.log(chalk.green(`ArchiveBuilder: ${archive.file_name} done (${archive.beatmapset_count} beatmapsets, ${archive.size_gb} GB)`));
        return true;
    }
}