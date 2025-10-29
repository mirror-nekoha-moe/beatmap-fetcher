const { Pool } = require('pg');
const path = require("path");
const dotenv = require("dotenv");
//const beatmapController = require('./beatmapController.cjs');

dotenv.config({ path: path.join(__dirname, ".env") });

const pool = new Pool({
  host: process.env.PG_HOSTNAME,
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  max: 1000,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 0
});

// Insert or update a beatmap row
async function insertBeatmap(beatmap) {
	const table = process.env.TABLE_BEATMAP;
	
	const client = await pool.connect();
	try {
		await client.query(`
			INSERT INTO public.${table} (
				id, creator, mode, beatmapset_id, status, cs, ar, od, hp,
				count_circles, count_sliders, count_spinners, bpm, total_length, version
			) VALUES (
				$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
			)
			ON CONFLICT (id) DO UPDATE SET
				creator = EXCLUDED.creator,
				mode = EXCLUDED.mode,
				beatmapset_id = EXCLUDED.beatmapset_id,
				status = EXCLUDED.status,
				cs = EXCLUDED.cs,
				ar = EXCLUDED.ar,
				od = EXCLUDED.od,
				hp = EXCLUDED.hp,
				count_circles = EXCLUDED.count_circles,
				count_sliders = EXCLUDED.count_sliders,
				count_spinners = EXCLUDED.count_spinners,
				bpm = EXCLUDED.bpm,
				total_length = EXCLUDED.total_length,
				version = EXCLUDED.version
		`, [
			beatmap.id, beatmap.creator, beatmap.mode, beatmap.beatmapset_id, beatmap.status,
			beatmap.cs, beatmap.ar, beatmap.od, beatmap.hp,
			beatmap.count_circles, beatmap.count_sliders, beatmap.count_spinners,
			beatmap.bpm, beatmap.total_length, beatmap.version
		]);
	} catch (err) {
  		console.error(err);
  		return null;
	} finally {
		client.release();
	}
}

// Insert or update a beatmapset row
async function insertBeatmapset(beatmapset) {
	const table = process.env.TABLE_BEATMAPSET;

	const client = await pool.connect();
	try {
		await client.query(`
			INSERT INTO public.${table} (
				id, status, title, artist, creator, beatmap_count,
				submitted, updated, ranked,
				missing_audio,
				source, tags, genre_id, language_id,
				title_unicode, artist_unicode
			) VALUES (
				$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
				$12,$13,$14,$15,$16
			)
			ON CONFLICT (id) DO UPDATE SET
				status = EXCLUDED.status,
				title = EXCLUDED.title,
				artist = EXCLUDED.artist,
				creator = EXCLUDED.creator,
				beatmap_count = EXCLUDED.beatmap_count,
				submitted = EXCLUDED.submitted,
				updated = EXCLUDED.updated,
				ranked = EXCLUDED.ranked,
				missing_audio = EXCLUDED.missing_audio,
				source = EXCLUDED.source,
				tags = EXCLUDED.tags,
				genre_id = EXCLUDED.genre_id,
				language_id = EXCLUDED.language_id,
				title_unicode = EXCLUDED.title_unicode,
				artist_unicode = EXCLUDED.artist_unicode
			`, [
				beatmapset.id, beatmapset.status, beatmapset.title, beatmapset.artist,
				beatmapset.creator, beatmapset.beatmaps.length, beatmapset.submitted_date,
				beatmapset.last_updated, beatmapset.ranked_date,
				beatmapset.availability.download_disabled, beatmapset.source, beatmapset.tags,
				beatmapset.genre_id, beatmapset.language_id,
				beatmapset.title_unicode, beatmapset.artist_unicode
			]
		);
	} catch (err) {
  		console.error(err);
  		return null;
	} finally {
		client.release();
	}
}

async function beatmapsetExists(id) {
	const client = await pool.connect();
	try {
		const res = await client.query(
			`SELECT 1 FROM ${process.env.TABLE_BEATMAPSET} WHERE id = $1 LIMIT 1`,
			[id]
		);
		return res.rowCount > 0;
	} catch (err) {
  		console.error(err);
  		return null;
	} finally {
		client.release();
	}
}

async function beatmapExists(id) {
	const client = await pool.connect();
	try {
		const res = await client.query(
			`SELECT 1 FROM ${process.env.TABLE_BEATMAP} WHERE id = $1 LIMIT 1`,
			[id]
		);
		return res.rowCount > 0;
	} catch (err) {
  		console.error(err);
  		return null;
	} finally {
		client.release();
	}
}

async function getBeatmapsetById(id) {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT * FROM ${process.env.TABLE_BEATMAPSET} WHERE id = $1`,
            [id]
        );
        return res.rows[0] || null;
    } finally {
        client.release();
    }
}

async function getHighestBeatmapsetId() {
	const client = await pool.connect();
	try {
		const query = `
			SELECT MAX(id) AS highest_id
			FROM ${process.env.TABLE_BEATMAPSET};
		`;
		const res = await client.query(query);
		return res.rows[0]?.highest_id || 0; // return 0 if table is empty
	} catch (err) {
  		console.error(err);
  		return null;
	} finally {
		client.release();
	}
}

async function updateStats() {
	console.log("Updating Stats Table...")
	const client = await pool.connect();
	try {
		const tableBeatmapset = process.env.TABLE_BEATMAPSET;
		const tableBeatmap = process.env.TABLE_BEATMAP;
		const tableStats = process.env.TABLE_STATS;
		// Ensure stats row exists (only one row)
		await client.query(`
			INSERT INTO public.${tableStats} (last_beatmapset_id)
			SELECT 0
			WHERE NOT EXISTS (SELECT 1 FROM public.${tableStats});
		`);
	  
		// Aggregate stats by osu! status codes
		const res = await client.query(`
			SELECT
				COALESCE(MAX(id), 0) AS last_beatmapset_id,
				(SELECT COUNT(*) FROM public.${tableBeatmapset}) AS beatmapset_count,
				(SELECT COUNT(*) FROM public.${tableBeatmap}) AS beatmap_count,
				(SELECT COUNT(*) FROM public.${tableBeatmapset} WHERE status = 1) AS ranked_count,
				(SELECT COUNT(*) FROM public.${tableBeatmapset} WHERE status = 2) AS approved_count,
				(SELECT COUNT(*) FROM public.${tableBeatmapset} WHERE status = 4) AS loved_count,
				(SELECT COUNT(*) FROM public.${tableBeatmapset} WHERE status = -2) AS graveyard_count,
				(SELECT COUNT(*) FROM public.${tableBeatmapset} WHERE status IN (-1,0,3)) AS pending_count
			FROM public.${tableBeatmapset};
		`);
	  
		const stats = res.rows[0];
	  
		// Update the stats row
		await client.query(`
			UPDATE public.${tableStats} SET
				last_beatmapset_id = $1,
				beatmapset_count = $2,
				beatmap_count = $3,
				ranked_count = $4,
				approved_count = $5,
				loved_count = $6,
				graveyard_count = $7,
				pending_count = $8
		`, [
		  stats.last_beatmapset_id,
		  stats.beatmapset_count,
		  stats.beatmap_count,
		  stats.ranked_count,
		  stats.approved_count,
		  stats.loved_count,
		  stats.graveyard_count,
		  stats.pending_count
		]);
		return stats;
	} catch (err) {
  		console.error(err);
  		return null;
	} finally {
		client.release();
	}
}

async function markBeatmapsetDownloaded(id, downloaded = true) {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE ${process.env.TABLE_BEATMAPSET} SET downloaded = $1 WHERE id = $2`,
            [downloaded, id]
        );
    } finally {
        client.release();
    }
}

async function markBeatmapsetDeleted(id, deleted = true) {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE ${process.env.TABLE_BEATMAPSET} SET deleted = $1 WHERE id = $2`,
            [deleted, id]
        );
    } finally {
        client.release();
    }
}

async function refreshAllBeatmapsetsFromOsu() {
	const beatmapController = require('./beatmapController.cjs');
    const client = await pool.connect();
    try {
        const tableBeatmapset = process.env.TABLE_BEATMAPSET;
        const res = await client.query(`SELECT id FROM public.${tableBeatmapset}`);
        const ids = res.rows.map(r => r.id);

        console.log(`Refreshing ${ids.length} beatmapsets from osu API...`);

        for (const id of ids) {
            await beatmapController.fetchBeatmapsetFromOsu(id);
        }

        console.log("Finished refreshing all beatmapsets.");
    } catch (err) {
        console.error("Error in refreshAllBeatmapsetsFromOsu:", err);
    } finally {
        client.release();
    }
}
module.exports = {
	insertBeatmap,
	insertBeatmapset,
	beatmapsetExists,
	beatmapExists,
	getHighestBeatmapsetId,
	updateStats,
	refreshAllBeatmapsetsFromOsu,
	getBeatmapsetById,
	markBeatmapsetDeleted,
	markBeatmapsetDownloaded
};
