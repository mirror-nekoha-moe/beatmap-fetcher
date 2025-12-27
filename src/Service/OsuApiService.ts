import chalk from 'chalk';
import * as osu from 'osu-api-v2-js';
import { Environment } from '@Bootstrap/Environment';

export class OsuApiService {

    static v1 = class {
        public static async getBeatmaps(sinceDate: string): Promise<any>{
            const url = `https://osu.ppy.sh/api/get_beatmaps?k=${Environment.env.OSU_API_V1_KEY}&since=${encodeURIComponent(sinceDate)}&limit=500`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(chalk.red(`v1 API returned ${response.status}: ${response.statusText}`));
            }
            return response.json();
        }
    }

    static v2 = class {

        /**
         * Do not use this, use getApiInstance() instead
        */
        public static osuApiInstance: osu.API | null = null;

        public static async authenticate(): Promise<void> {
            try {
                console.log(chalk.cyan("Authenticating with osu! API..."));
                this.osuApiInstance = await osu.API.createAsync(
                    parseInt(Environment.env.OSU_API_CLIENT_ID!, 10),
                    Environment.env.OSU_API_CLIENT_SECRET!
                );
                console.log(chalk.green("osu! API authenticated successfully"));
            } catch (err) {
                console.error(chalk.red("Failed to authenticate osu! API:"), err instanceof Error ? err.message : err);
                throw err;
            }
        }
        public static async getApiInstance(): Promise<osu.API> {
            while (!this.osuApiInstance) {
                await this.authenticate();
                if (!this.osuApiInstance) {
                    console.log(chalk.yellow("Could not authenticate to the osu! Api."));
                    console.log(chalk.yellow("Retrying osu! API authentication in 5 seconds..."));
                    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s delay
                }
            }
            return this.osuApiInstance!;
        }
    }
}