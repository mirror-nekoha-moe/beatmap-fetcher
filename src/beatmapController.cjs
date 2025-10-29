const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const dotenv = require("dotenv");
const { Curl } = require('node-libcurl');
const osu = require("osu-api-v2-js");
const db = require('./pgDatabaseController.cjs');

dotenv.config({ path: path.join(__dirname, ".env") });

const basePath = path.resolve(__dirname, process.env.STORAGE_DIR);
const COOKIE_FILE = path.resolve(__dirname, process.env.COOKIE_FILE);

const modeMap = { 
	osu: 0,
	taiko: 1,
	fruits: 2,
	mania: 3
};
const statusMap = {
    graveyard: -2,
    pending: 0,
    ranked: 1,
    approved: 2,
    loved: 4
};

let osu_session = "";
let osuApiInstance = null;

async function osuAuthenticate() {
	if (osuApiInstance) return osuApiInstance;
    try {
        console.log("Creating osu.API.createAsync...");
        osuApiInstance = await osu.API.createAsync(
			process.env.OSU_API_CLIENT_ID,
			process.env.OSU_API_CLIENT_SECRET,
        );
        console.log("osu API authenticated successfully!");
    } catch (err) {
        console.error("Failed to authenticate osu API:", err);
        throw err;
    }
}

function readCookie() {
  try {
    osu_session = fs.readFileSync(COOKIE_FILE, "utf-8").trim();
    console.log("Successfully read cookie file");
  } catch (err) {
    console.error("Failed to read cookie file", err);
  }
}

async function getDownloadUrl(beatmapsetId) {
	if (!osu_session || typeof osu_session !== "string") {
		throw new Error("osu_session must be a non-empty string");
	}

	// Decode once if needed (sometimes %25 means double-encoded)
	let cookieValue = osu_session;
	if (cookieValue.includes("%25")) cookieValue = decodeURIComponent(cookieValue);

	const url = `https://osu.ppy.sh/beatmapsets/${beatmapsetId}/download?noVideo=1`;

	return await new Promise((resolve, reject) => {
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

		curl.on("end", function (statusCode, body, headers) {
			const finalUrl = this.getInfo("EFFECTIVE_URL");
			this.close();

			if (!finalUrl || !finalUrl.startsWith("https://bm")) {
				return reject(new Error("Invalid download domain: " + finalUrl));
			}
			resolve(finalUrl);
		});

		curl.on("error", function (err) {
			this.close();
			reject(err);
		});

		curl.perform();
	});
}

async function downloadBeatmapSet(url, beatmapsetId) {
	// Create the beatmapset folder
	const folderPath = path.join(basePath, String(beatmapsetId));
	fs.mkdirSync(folderPath, { recursive: true });

	const res = await fetch(url);
	if (!res.ok) throw new Error("Failed to download: " + res.statusText);

	// Get filename from Content-Disposition header
	const cd = res.headers.get("content-disposition");
	if (!cd) throw new Error("Server did not provide a filename");

	const match = cd.match(/filename\*=UTF-8''(.+)|filename="(.+)"/);
	if (!match) throw new Error("Could not extract filename from headers");

	const filename = decodeURIComponent(match[1] || match[2]);
	const filePath = path.join(folderPath, filename);

	// Stream response to disk
	const fileStream = fs.createWriteStream(filePath);
	await new Promise((resolve, reject) => {
		res.body.pipe(fileStream);
		res.body.on("error", reject);
		fileStream.on("finish", resolve);
	});

	console.log("Downloaded:" + filePath);
	return filePath;
}

async function findNextHighestBeatmapset(currentHighestId) {
    const step = 5000;
    let newHighest = currentHighestId;
    let foundAny = false;

    console.log(`Searching for new beatmapsets ${currentHighestId + 1}-${currentHighestId + step}...`);

    for (let id = currentHighestId + 1; id <= currentHighestId + step; id++) {
        const beatmapset = await fetchBeatmapsetFromOsu(id);
        if (beatmapset) {
            newHighest = id;
            foundAny = true;
        }
    }

    if (!foundAny) console.log(`No new beatmapsets found in this range.`);
    else console.log(`Updated highest known beatmapset ID to ${newHighest}`);

    return newHighest;
}

async function fetchBeatmapsetFromOsu(id) {
    try {
        // Correct API call
		const beatmapset = await osuApiInstance.getBeatmapset(id); 

        // If API returns null → treat as deleted
        if (!beatmapset) {
            const exists = await db.beatmapsetExists(id);
            if (exists) {
                await db.markBeatmapsetDeleted(id, true);
                console.warn(`Beatmapset ${id} not found → marked as deleted in DB`);
            } else {
                console.warn(`Beatmapset ${id} not found and not in DB`);
            }
            return null;
        }

        // Check if we need to re-download
        const dbRow = await db.getBeatmapsetById(id);
        let needDownload = false;

        if (!dbRow) {
            needDownload = true;
        } else {
            const apiUpdated = new Date(beatmapset.updated);
            const dbUpdated = dbRow.updated ? new Date(dbRow.updated) : null;

            // Re-download if DB missing or API has newer update
            if (!dbRow.downloaded || (dbUpdated && apiUpdated > dbUpdated)) {
                needDownload = true;
            }
        }

		beatmapset.status = statusMap[beatmapset.status] ?? 0;
        beatmapset.osu = modeMap['osu'] ?? 0;
        beatmapset.taiko = modeMap['taiko'] ?? 0;
        beatmapset.fruits = modeMap['fruits'] ?? 0;
        beatmapset.mania = modeMap['mania'] ?? 0;
        
		// Insert or update beatmapset
        await db.insertBeatmapset({
            ...beatmapset,
            deleted: false,
            downloaded: needDownload
        });

        // Insert or update each beatmap individually
        if (beatmapset.beatmaps && Array.isArray(beatmapset.beatmaps)) {
            for (const bm of beatmapset.beatmaps) {
				bm.mode = modeMap[bm.mode] ?? 0;
				bm.status = statusMap[bm.status] ?? 0;
                await db.insertBeatmap(bm);
            }
        }

        // Download if needed and not deleted
        if (needDownload && !beatmapset.deleted) {
            try {
                const downloadUrl = await getDownloadUrl(id);
                await downloadBeatmapSet(downloadUrl, id);
                await db.markBeatmapsetDownloaded(id, true);
            } catch (dlErr) {
                console.warn(`Download failed for beatmapset ${id}: ${dlErr.message}`);
            }
        }

        console.log(`Fetched and processed beatmapset ${id} (${beatmapset.title} - ${beatmapset.artist})`);
        return beatmapset;

    } catch (err) {
        // Preserve your detailed logging
        console.error(`Error in fetchBeatmapsetFromOsu(${id}):`, err.message);
        return null;
    }
}
module.exports = { getDownloadUrl, downloadBeatmapSet, readCookie, osuAuthenticate, findNextHighestBeatmapset, fetchBeatmapsetFromOsu };
