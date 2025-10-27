const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const basePath = path.resolve(__dirname, process.env.STORAGE_DIR);
const COOKIE_FILE = path.resolve(_dirname, process.env.COOKIE_FILE);

let osu_session = "";

function readCookie() {
  try {
    osu_session = fs.readFileSync(COOKIE_FILE, "utf-8").trim();
  } catch (err) {
    console.error("Failed to read cookie file", err);
  }
}

readCookie();
setInterval(readCookie, 3600 * 1000);

async function getDownloadUrl(beatmapsetId) {
    // download link with no video
    const url = `https://osu.ppy.sh/beatmapsets/${beatmapsetId}/download?noVideo=1`;

    const response = await fetch(url, {
    method: "GET",
    headers: {
        'Accept': "*/*",
        "Cookie": osu_session
    },
        // important! so fetch does not follow redirects
        redirect: "manual"
    });

    // The final download URL is "Location"
    const finalUrl = response.headers.get("location");
    if (!finalUrl) {
        throw new Error("Could not get location URL.");
    }

    try {
        const parsed = new URL(finalUrl);
        if (!parsed.hostname.startsWith("bm")) {
            throw new Error(`Invalid download domain: ${parsed.hostname}`);
        }
    } catch (err) {
        throw new Error("Invalid URL returned: " + finalUrl);
    }
    return finalUrl;
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

// Export the functions
module.exports = { getDownloadUrl, downloadBeatmapSet };