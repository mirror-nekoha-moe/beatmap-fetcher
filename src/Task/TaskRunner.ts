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
            StatsUpdater.run(5, 1);
            BeatmapsetUpdater.run(1, 30);
            BeatmapsetFetcher.run(1, 10);
            RecentScanner.run(60, 10);
            MissingScanner.run(1440, 10);
        } catch (err) {
            console.error(chalk.red("TaskRunner encountered an error:"), err instanceof Error ? err.message : err);
            process.exit(1);
        }
    }
}