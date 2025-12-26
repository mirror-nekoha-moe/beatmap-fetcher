import path from 'path';
import dotenv from 'dotenv';
import { SchemaUpdater } from './Core/Database/SchemaUpdater';
import { Environment } from './Bootstrap/Environment';
import { Logger } from './Core/Logging/Logger';
import { thControllerMain } from './threadController';

dotenv.config({ path: path.join(__dirname, `.env.${process.env.NODE_ENV}`) });

async function main(): Promise<void> {
    Logger.hookConsole();

    console.log("[ beatmap-fetcher ]");
    await Environment.check();
    await SchemaUpdater.init();
    thControllerMain();
    console.log("main() execution done.");   
}

main().catch((err) => {
    console.error('Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
});
