import fs from 'fs';
import fsp from 'fs/promises';
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

            // mimic curl -L
            curl.setOpt("SSL_VERIFYPEER", false);

            curl.on("end", function (this: Curl, statusCode: number, body: Buffer, headers: Array<string>) {
                const finalUrl = String(this.getInfo("EFFECTIVE_URL"));
                this.close();

                if (statusCode === 429) {
                    return reject(new Error(`Rate limited (429) when fetching download URL for beatmapset ${beatmapsetId}`));
                }
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
        const MAX_ATTEMPTS = 3;
        let lastError: unknown;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return await DownloadService.attemptDownload(url, beatmapsetId, attempt);
            } catch (err) {
                lastError = err;
                if (attempt < MAX_ATTEMPTS) {
                    console.warn(chalk.yellow(`[Download] Attempt ${attempt}/${MAX_ATTEMPTS} failed for ${beatmapsetId}: ${err instanceof Error ? err.message : err}. Retrying...`));
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                }
            }
        }
        throw lastError;
    }

    private static async attemptDownload(url: string, beatmapsetId: number, attempt: number): Promise<{ filePath: string; fileSize: number }> {
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

        let filename: string;
        try {
            filename = decodeURIComponent(match[1] || match[2]);
        } catch {
            // Filename contains invalid percent-encoded sequences - use raw value
            filename = match[1] || match[2];
        }
        
        // Sanitize filename: replace invalid filesystem characters
        // Replace characters that are illegal in SMB/CIFS filenames
        // / -> ⧸ (U+29F8), \ -> ⧹ (U+29F9), : -> ː (U+02D0)
        filename = filename.replace(/\//g, '⧸').replace(/\\/g, '⧹').replace(/:/g, 'ː');
        
        const filePath = path.join(folderPath, filename);

        // Stream response to disk
        const fileStream = fs.createWriteStream(filePath);
        const readableStream = Readable.fromWeb(response.body as any);
        try {
            await pipeline(readableStream, fileStream);
        } catch (err) {
            // Clean up partial file on stream failure
            try { fs.unlinkSync(filePath); } catch {}
            throw err;
        }

        // Strip multipart form-data wrapper if present.
        // Some responses prepend headers before the ZIP content (PK\x03\x04 magic).
        await DownloadService.stripMultipartPrefix(filePath);

        // Validate the zip has a proper end-of-central-directory signature
        await DownloadService.validateZip(filePath);

        // Get file size in bytes
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        console.log(chalk.cyan(`Downloaded: ${chalk.whiteBright(filePath)} (${chalk.whiteBright((fileSize / (1024 * 1024)).toFixed(2))} MB)`));
        return { filePath, fileSize };
    }

    /**
     * Validates that the file is a complete zip archive by checking for the
     * end-of-central-directory (EOCD) signature in the last 64KB of the file.
     * Throws if the signature is not found (truncated/corrupt download).
     */
    private static async validateZip(filePath: string): Promise<void> {
        const EOCD_SIG = Buffer.from([0x50, 0x4B, 0x05, 0x06]); // PK\x05\x06
        const CHECK_TAIL = 65536; // EOCD can be up to 64KB from end due to zip comment

        const stat = await fsp.stat(filePath);
        if (stat.size < 22) throw new Error(`File too small to be a valid zip: ${filePath}`);

        const readSize = Math.min(CHECK_TAIL, stat.size);
        const buf = Buffer.alloc(readSize);
        const fd = await fsp.open(filePath, 'r');
        try {
            await fd.read(buf, 0, readSize, stat.size - readSize);
        } finally {
            await fd.close();
        }

        // Search backwards for EOCD signature
        for (let i = buf.length - 22; i >= 0; i--) {
            if (buf[i] === EOCD_SIG[0] && buf[i+1] === EOCD_SIG[1] &&
                buf[i+2] === EOCD_SIG[2] && buf[i+3] === EOCD_SIG[3]) {
                return; // valid
            }
        }

        // Not found - delete corrupt file and throw so retry kicks in
        try { fs.unlinkSync(filePath); } catch {}
        throw new Error(`Zip validation failed (no EOCD signature): ${path.basename(filePath)} — file deleted for re-download`);
    }

    /**
     * If the file is prefixed with a multipart form-data header (i.e. does not start
     * with the ZIP magic bytes PK\x03\x04), find the real ZIP start and truncate the file
     * in-place by rewriting it without the prefix.
     */
    private static async stripMultipartPrefix(filePath: string): Promise<void> {
        const ZIP_MAGIC = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK\x03\x04
        const PEEK = 4096; // enough to find the boundary + headers

        const fd = await fsp.open(filePath, 'r+');
        try {
            const peek = Buffer.alloc(PEEK);
            const { bytesRead } = await fd.read(peek, 0, PEEK, 0);
            if (bytesRead < 4) return;

            // If already starts with PK, nothing to do
            if (peek[0] === ZIP_MAGIC[0] && peek[1] === ZIP_MAGIC[1] &&
                peek[2] === ZIP_MAGIC[2] && peek[3] === ZIP_MAGIC[3]) return;

            const offset = peek.indexOf(ZIP_MAGIC, 0);
            if (offset <= 0) return; // no ZIP magic found - leave as-is

            console.log(chalk.yellow(`Stripping ${offset}-byte multipart prefix from ${path.basename(filePath)}`));

            const stat = await fd.stat();
            const totalSize = stat.size;
            const newSize = totalSize - offset;

            // Stream the file contents forward by 'offset' bytes
            const CHUNK = 1024 * 1024; // 1 MB chunks
            let readPos = offset;
            let writePos = 0;
            const buf = Buffer.alloc(CHUNK);
            while (readPos < totalSize) {
                const { bytesRead: n } = await fd.read(buf, 0, CHUNK, readPos);
                if (n === 0) break;
                await fd.write(buf, 0, n, writePos);
                readPos += n;
                writePos += n;
            }
            await fd.truncate(newSize);
        } finally {
            await fd.close();
        }
    }
}