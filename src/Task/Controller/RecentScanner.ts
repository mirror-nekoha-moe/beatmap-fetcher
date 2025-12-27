import { BeatmapsetController } from '@Domain/Beatmapset/Controller/BeatmapsetController';
import { BaseTask } from '@Task/BaseTask';

export class RecentScanner {
    static async run(interval: number, errorDelay: number): Promise<void> {
        await BaseTask.runTask(interval*60*1000, errorDelay*60*1000, this.name, async () => {
            await BeatmapsetController.scanRecentlyRankedBeatmapsets();
        });
    }
}