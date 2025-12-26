import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export class CookieService {
  private static COOKIE_FILE = path.resolve(__dirname, process.env.COOKIE_FILE!);
  private static osu_session: string = "";

  public static readCookie(): void {
    try {
      this.osu_session = fs.readFileSync(this.COOKIE_FILE, "utf-8").trim();
      console.log(chalk.green("Successfully read cookie file"));
    } catch (err) {
      console.error(
        chalk.red("Failed to read cookie file:"),
        err instanceof Error ? err.message : err
      );
    }
  }

  public static getSession(): string {
    return this.osu_session;
  }
}
