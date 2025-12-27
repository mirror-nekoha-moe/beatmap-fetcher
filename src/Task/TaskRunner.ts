import chalk from 'chalk';
import { BeatmapsetFetcher } from '@Task/Controller/BeatmapsetFetcher';
import { BeatmapsetUpdater } from '@Task/Controller/BeatmapsetUpdater';
import { CookieReader } from '@Task/Controller/CookieReader';
import { MissingScanner } from '@Task/Controller/MissingScanner';
import { OsuAuthenticator } from '@Task/Controller/OsuAuthenticator';
import { RecentScanner } from '@Task/Controller/RecentScanner';
import { StatsUpdater } from '@Task/Controller/StatsUpdater';

export class TaskRunner {
    static async run(): Promise<void> {
        try {
            OsuAuthenticator.run(120, 1);
            CookieReader.run(60, 1);
            StatsUpdater.run(300 * 1000);
            BeatmapsetUpdater.run(0);
            BeatmapsetFetcher.run(0);
            RecentScanner.run(60 * 60 * 1000);
            MissingScanner.run(24 * 60 * 60 * 1000);
        } catch (err) {
            console.error(chalk.red("TaskRunner encountered an error:"), err instanceof Error ? err.message : err);
            process.exit(1);
        }
    }
}