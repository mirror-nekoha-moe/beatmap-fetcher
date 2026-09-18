import chalk from 'chalk';
import { BaseTask } from '@Task/BaseTask';
import { TaskQueueRepository } from '@Domain/TaskQueue/Repository/TaskQueueRepository';
import { TaskQueueHandler } from '@Domain/TaskQueue/Controller/TaskQueueHandler';

export class TaskQueueWorker {
    static async poll(): Promise<void> {
        const job = await TaskQueueRepository.claimNext();
        // nothing pending
        if (!job)
            return;

        console.log(chalk.cyan(`[TaskQueue] Starting job #${job.id}: ${job.task}`), job.params);
        try {
            await TaskQueueHandler.handle(job);
            await TaskQueueRepository.markDone(job.id);
            console.log(chalk.green(`[TaskQueue] Job #${job.id} (${job.task}) completed`));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await TaskQueueRepository.markFailed(job.id, msg);
            console.error(chalk.red(`[TaskQueue] Job #${job.id} (${job.task}) failed: ${msg}`));
        }
        await TaskQueueRepository.cleanup().catch(() => {});
    }

    static async run(pollIntervalSeconds: number = 10): Promise<void> {
        await TaskQueueRepository.ensureTable();
        console.log(chalk.cyan(`[TaskQueue] Worker started, polling every ${pollIntervalSeconds}s`));

        await BaseTask.runTask(
            pollIntervalSeconds * 1000,
            30_000,
            this.name,
            () => this.poll()
        );
    }
}
