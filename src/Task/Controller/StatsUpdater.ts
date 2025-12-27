import { StatsRepository } from '@Domain/Stats/Repository/StatsRepository';
import { BaseTask } from '@Task/BaseTask';

export class StatsUpdater {
    static async run(interval: number, errorDelay: number): Promise<void> {
        await BaseTask.runTask(interval*60*1000, errorDelay*60*1000, this.name, async () => {
            await StatsRepository.updateStats();
        });
    }
}