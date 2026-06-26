import chalk from 'chalk';
import { ApiCallLogService } from '@Service/ApiCallLogService';
import { BeatmapsetFetcher } from '@Task/Controller/BeatmapsetFetcher';
import { BeatmapsetUpdater } from '@Task/Controller/BeatmapsetUpdater';
import { CookieReader } from '@Task/Controller/CookieReader';
import { GraveyardDownloader } from '@Task/Controller/GraveyardDownloader';
import { MissingScanner } from '@Task/Controller/MissingScanner';
import { OsuAuthenticator } from '@Task/Controller/OsuAuthenticator';
import { QualifiedUpdater } from '@Task/Controller/QualifiedUpdater';
import { RecentScanner } from '@Task/Controller/RecentScanner';
import { StatsUpdater } from '@Task/Controller/StatsUpdater';
import { TaskQueueWorker } from '@Task/Controller/TaskQueueWorker';

export class TaskRunner {
    static async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    
    static async run(): Promise<void> {
        try {
            ApiCallLogService.start();
            OsuAuthenticator.run(120, 1);
            CookieReader.run(60, 1);

            // Make sure API and Cookie are ready
            await this.sleep(15000);

            StatsUpdater.run(5, 1);
            await this.sleep(5000);

            // MissingScanner disabled - processBeatmapset already self-heals downloaded state
            // inline, and BeatmapsetUpdater's filtered query includes all downloaded=false maps.
            // MissingScanner.run(10080, 60);

            BeatmapsetUpdater.run(1, 30);
            BeatmapsetFetcher.run(1, 10);
            RecentScanner.run(1440, 10);

            // Check qualified maps once per day — updates them to ranked/loved if they passed
            QualifiedUpdater.run(1440, 10);

            // Download graveyard/pending/wip maps slowly (once per day, 400/day default)
            GraveyardDownloader.run(1440, 30);

            // Task queue worker - polls DB every 10s for jobs enqueued externally (e.g. from Discord bot)
            TaskQueueWorker.run(10);
        } catch (err) {
            console.error(chalk.red("TaskRunner encountered an error:"), err instanceof Error ? err.message : err);
            process.exit(1);
        }
    }
}