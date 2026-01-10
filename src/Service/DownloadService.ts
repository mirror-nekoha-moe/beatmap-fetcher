import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import chalk from 'chalk';
import { Curl } from 'node-libcurl';

import { Environment } from '@Bootstrap/Environment';
import { CookieService } from "Service/CookieService";

export class DownloadService {
    static basePath = path.resolve(__dirname, Environment.env.STORAGE_DIR!);

    static async getDownloadUrl(beatmapsetId: number): Promise<string> {
        let osu_session = CookieService.getSession();

        if (!osu_session) {
            throw new Error("osu_session must be a non-empty string");
        }

        // Decode once if needed (sometimes %25 means double-encoded)
        let cookieValue = osu_session;
        if (cookieValue.includes("%25")) cookieValue = decodeURIComponent(cookieValue);

        const url = `https://osu.ppy.sh/beatmapsets/${beatmapsetId}/download`;

        return await new Promise<string>((resolve, reject) => {
            const curl = new Curl();

            curl.setOpt("URL", url);
            curl.setOpt("FOLLOWLOCATION", true);
            curl.setOpt("COOKIE", cookieValue);
            curl.setOpt("REFERER", `https://osu.ppy.sh/beatmapsets/${beatmapsetId}`);
            curl.setOpt("HTTPHEADER", [
                "Accept: */*",
                "Connection: keep-alive",
            ]);
            curl.setOpt("SSL_VERIFYPEER", false); // optional: mimic curl -L

            curl.on("end", function (this: Curl, statusCode: number, body: Buffer, headers: Array<string>) {
                const finalUrl = String(this.getInfo("EFFECTIVE_URL"));
                this.close();

                if (!finalUrl || !finalUrl.startsWith("https://bm")) {
                    return reject(new Error("Invalid download domain: " + finalUrl + "\n" + chalk.yellow("**(Probably Download disabled)**")));
                }
                resolve(finalUrl);
            });

            curl.on("error", function (this: Curl, err: Error) {
                this.close();
                reject(err);
            });

            curl.perform();
        });
    }

    static async downloadBeatmapset(url: string, beatmapsetId: number): Promise<{ filePath: string; fileSize: number }> {
        // Create the beatmapset folder
        const folderPath = path.join(this.basePath, String(beatmapsetId));
        fs.mkdirSync(folderPath, { recursive: true });

        // Fetch types are implicitly included in recent Node versions but let's add a type check
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to download: " + response.statusText);

        // Get filename from Content-Disposition header
        const cd = response.headers.get("content-disposition");
        if (!cd) throw new Error("Server did not provide a filename");

        const match = cd.match(/filename\*=UTF-8''(.+)|filename="(.+)"/);
        if (!match) throw new Error("Could not extract filename from headers");

        let filename = decodeURIComponent(match[1] || match[2]);
        
        // Sanitize filename: replace invalid filesystem characters
        // Replace / with ⧸ (division slash U+29F8) and \ with ⧹ (reverse solidus U+29F9)
        filename = filename.replace(/\//g, '⧸').replace(/\\/g, '⧹');
        
        const filePath = path.join(folderPath, filename);

        // Stream response to disk
        const fileStream = fs.createWriteStream(filePath);
        const readableStream = Readable.fromWeb(response.body as any);
        await pipeline(readableStream, fileStream);

        // Get file size in bytes
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        console.log(chalk.cyan(`Downloaded: ${chalk.whiteBright(filePath)} (${chalk.whiteBright((fileSize / (1024 * 1024)).toFixed(2))} MB)`));
        return { filePath, fileSize };
    }
}