import { Environment } from '@Bootstrap/Environment';

async function main(): Promise<void> {
    await Environment.initialize();

    const { SchemaUpdater } = await import('@Core/Database/SchemaUpdater');
    const { Logger } = await import('@Core/Logging/Logger');
    const { TaskRunner } = await import('@Task/TaskRunner');

    Logger.hookConsole();
    console.log("[ beatmap-fetcher ]");
    await SchemaUpdater.initialize();
    TaskRunner.run();
    console.log("main() execution done.");   
}

main().catch((err) => {
    console.error('Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
});
