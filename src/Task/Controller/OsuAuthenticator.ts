import chalk from 'chalk';
import { BaseTask } from '@Task/BaseTask';
import { OsuApiService } from '@Service/OsuApiService';

export class OsuAuthenticator {
    static async run(interval: number, errorDelay: number): Promise<void> {
        await BaseTask.runTask(interval*60*1000, errorDelay*60*1000, this.name, async () => {
            console.log(chalk.cyan("Authenticating with osu! API..."));
            await OsuApiService.v2.authenticate();
            console.log(chalk.green("osu! API authenticated successfully"));    
        });
    }
}