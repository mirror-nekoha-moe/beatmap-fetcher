import chalk from 'chalk';

export abstract class BaseTask {
    static async runTask(interval: number, errorDelay: number, taskName: string, task: () => Promise<void>): Promise<void> {
        let intervalHandle: NodeJS.Timeout | null = null;
        let retryHandle: NodeJS.Timeout | null = null;
        let inErrorBackoff = false;

        const startInterval = () => {
            if (intervalHandle) return;
            intervalHandle = setInterval(execute, interval);
        };

        const execute = async (): Promise<void> => {
            try {
                await task();

                // Recover from error state
                if (inErrorBackoff) {
                    console.log(
                        chalk.green(`Task::${taskName} recovered, resuming normal schedule`)
                    );
                    inErrorBackoff = false;

                    if (retryHandle) {
                        clearTimeout(retryHandle);
                        retryHandle = null;
                    }

                    startInterval();
                }
            } catch (err) {
                console.error(
                    chalk.red(`Task::${taskName} encountered an error:`),
                    err instanceof Error ? err.message : err
                );

                if (intervalHandle) {
                    clearInterval(intervalHandle);
                    intervalHandle = null;
                }

                if (!inErrorBackoff) {
                    inErrorBackoff = true;
                    console.log(
                        chalk.yellow(
                            `Task::${taskName} retrying in ${errorDelay / 60000} minutes...`
                        )
                    );
                }

                if (!retryHandle) {
                    retryHandle = setTimeout(async () => {
                        retryHandle = null;
                        await execute();
                    }, errorDelay);
                }
            }
        };

        console.log(chalk.cyan(`Starting Task::${taskName}`));

        // Run immediately
        await execute();

        if (!inErrorBackoff) {
            startInterval();
        }
    }
}
