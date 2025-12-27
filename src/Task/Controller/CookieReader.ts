import { CookieService } from '@Service/CookieService';
import { BaseTask } from '@Task/BaseTask';

export class CookieReader {
    static async run(interval: number, errorDelay: number): Promise<void> {
        await BaseTask.runTask(interval*60*1000, errorDelay*60*1000, this.name, async () => {
            await CookieService.readCookie();
        });
    }
}