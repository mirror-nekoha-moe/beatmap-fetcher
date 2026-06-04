import chalk from 'chalk';
import { BeatmapsetController } from '@Domain/Beatmapset/Controller/BeatmapsetController';
import { BeatmapsetRepository } from '@Domain/Beatmapset/Repository/BeatmapsetRepository';
import { BaseTask } from '@Task/BaseTask';
import { OsuApiService } from '@Service/OsuApiService';

export class QualifiedUpdater {
    static async run(interval: number, errorDelay: number): Promise<void> {
        await BaseTask.runTask(interval * 60 * 1000, errorDelay * 60 * 1000, this.name, async () => {
            await this.refreshQualifiedBeatmapsets();
        });
    }

    static async refreshQualifiedBeatmapsets(): Promise<void> {
        const osuApiInstance = await OsuApiService.v2.getApiInstance();

        const ids = await BeatmapsetRepository.getQualifiedBeatmapsetIds();
        if (ids.length === 0) {
            console.log(chalk.gray('QualifiedUpdater: no qualified beatmapsets in DB, skipping.'));
            return;
        }

        console.log(chalk.cyan(`QualifiedUpdater: refreshing ${ids.length} qualified beatmapsets...`));

        let ranked = 0;
        let stillQualified = 0;
        let other = 0;

        for (let i = 0; i < ids.length; i += 3) {
            const chunk = ids.slice(i, i + 3);
            const results = await Promise.all(
                chunk.map(id =>
                    osuApiInstance.getBeatmapset(id).catch((err: unknown) => {
                        console.warn(chalk.yellow(`QualifiedUpdater: failed to fetch ${id}:`), err instanceof Error ? err.message : err);
                        return null;
                    })
                )
            );

            for (const bs of results) {
                if (!bs) continue;
                const prev = 'qualified';
                await BeatmapsetController.processBeatmapset(bs, true);
                const status = String(bs.status);
                if (status === 'ranked' || status === 'approved' || status === 'loved') {
                    console.log(chalk.green(`QualifiedUpdater: ${bs.id} → ${status} ✓`));
                    ranked++;
                } else if (status === 'qualified') {
                    stillQualified++;
                } else {
                    console.log(chalk.yellow(`QualifiedUpdater: ${bs.id} → ${status}`));
                    other++;
                }
            }

            // ~3 req/sec
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(chalk.green(
            `QualifiedUpdater: done. Newly ranked/loved: ${ranked}, still qualified: ${stillQualified}, other: ${other}`
        ));
    }
}
