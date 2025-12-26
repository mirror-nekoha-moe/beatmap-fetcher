import chalk from 'chalk';
import * as osu from 'osu-api-v2-js';

export class OsuApiService {
  private static osuApiInstance: osu.API | null = null;

  public static async authenticate(): Promise<void> {
      try {
          console.log(chalk.cyan("Authenticating with osu! API..."));
          this.osuApiInstance = await osu.API.createAsync(
              parseInt(process.env.OSU_API_CLIENT_ID!, 10),
              process.env.OSU_API_CLIENT_SECRET!
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