import { SchemaUpdater } from '@Core/Database/SchemaUpdater';
import { Logger } from '@Core/Logging/Logger';
import { Environment } from '@Bootstrap/Environment';
import { thControllerMain } from './threadController';

async function main(): Promise<void> {
    Logger.hookConsole();

    console.log("[ beatmap-fetcher ]");
    await Environment.initialize();
    await SchemaUpdater.initialize();
    thControllerMain();
    console.log("main() execution done.");   
}

main().catch((err) => {
    console.error('Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
});
