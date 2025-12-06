import * as beatmapController from './beatmapController';
import * as db from './pgDatabaseController';
import * as thHelper from './threadHelper';
import chalk from 'chalk';

async function thControllerMain(): Promise<void> {
    try {
        // Authenticate with osu! API and refresh every 2 hours
        await beatmapController.osuAuthenticate();
        setInterval(beatmapController.osuAuthenticate, 2 * 60 * 60 * 1000);
        console.log(chalk.cyan("Set osuAuthenticate() to execute every 2 hours"));

        // Read cookie file and refresh every hour
        await beatmapController.readCookie();
        setInterval(beatmapController.readCookie, 3600 * 1000);
        console.log(chalk.cyan("Set readCookie() to execute once per hour"));

        // Update database statistics every 5 minutes
        await db.updateStats();
        setInterval(db.updateStats, 300 * 1000);
        console.log(chalk.cyan("Set updateStats() to execute every 5min"));

        // Start continuous loop to refresh ALL existing beatmapsets
        // This runs continuously - as soon as it finishes all beatmapsets, it starts again
        // This ensures all metadata and downloads are always up-to-date
        thHelper.continuouslyRefreshAllBeatmapsets().catch(err => {
            console.error(chalk.red("Continuous refresh loop crashed:"), err instanceof Error ? err.message : err);
            process.exit(1);
        });
        console.log(chalk.green("Started continuouslyRefreshAllBeatmapsets() loop"));

        // Start continuous loop to fetch NEW beatmapsets
        // This runs continuously, checking for new maps every 5 minutes
        thHelper.continuouslyFetchNewBeatmapsets().catch(err => {
            console.error(chalk.red("Continuous fetch loop crashed:"), err instanceof Error ? err.message : err);
            process.exit(1);
        });
        console.log(chalk.green("Started continuouslyFetchNewBeatmapsets() loop"));

        // Start continuous loop to scan recently ranked beatmapsets
        // This catches old maps that got ranked late (every hour)
        thHelper.continuouslyScanRecentlyRanked().catch(err => {
            console.error(chalk.red("Recently ranked scan loop crashed:"), err instanceof Error ? err.message : err);
            process.exit(1);
        });
        console.log(chalk.green("Started continuouslyScanRecentlyRanked() loop"));
    } catch (err) {
        console.error(chalk.red("threadControllerMain encountered an error:"), err instanceof Error ? err.message : err);
        process.exit(1);
    }
}

export { thControllerMain };