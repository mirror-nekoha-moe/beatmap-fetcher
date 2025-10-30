import path from 'path';
import dotenv from 'dotenv';
import { init } from './pgDatabaseInit';
import { checkEnvVariables } from './envInit';
import { thControllerMain } from './threadController';

dotenv.config({ path: path.join(__dirname, '.env') });

async function main(): Promise<void> {
    console.log("[ beatmap-fetcher ]");
    await checkEnvVariables();
    await init();
    thControllerMain();
    console.log("main() execution done.");   
}

main().catch((err) => {
    console.error('Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
});
