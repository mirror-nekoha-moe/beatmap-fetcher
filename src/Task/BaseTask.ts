import chalk from 'chalk';

export abstract class BaseTask {
    static async runTask(interval: number, errorDelay: number, taskName: string, task: () => Promise<void>): Promise<void> {
        let timer: NodeJS.Timeout | null = null;
        let inErrorBackoff = false;
        let running = false;

        const schedule = (delay: number) => {
            if (timer) return;

            timer = setTimeout(async () => {
                timer = null;
                await execute();
            }, delay);
        };

        const execute = async (): Promise<void> => {
            if (running) return;

            running = true;

            try {
                await task();

                if (inErrorBackoff) {
                    console.log(
                        chalk.green(`Task::${taskName} recovered, resuming normal schedule`)
                    );
                    inErrorBackoff = false;
                }

                schedule(interval);
            } catch (err) {
                console.error(
                    chalk.red(`Task::${taskName} encountered an error:`),
                    err instanceof Error ? err.message : err
                );

                if (!inErrorBackoff) {
                    inErrorBackoff = true;
                    console.log(
                        chalk.yellow(
                            `Task::${taskName} retrying in ${errorDelay / 60000} minutes...`
                        )
                    );
                }

                schedule(errorDelay);
            } finally {
                running = false;
            }
        };

        console.log(chalk.cyan(`Starting Task::${taskName}`));
        await execute();
    }
}
