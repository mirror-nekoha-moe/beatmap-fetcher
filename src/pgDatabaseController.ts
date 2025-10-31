import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

interface DatabaseStats {
    last_beatmapset_id: number;
    beatmapset_count: number;
    beatmap_count: number;
    ranked_count: number;
    approved_count: number;
    loved_count: number;
    graveyard_count: number;
    pending_count: number;
    total_size: number;
}

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
async function insertBeatmap(beatmap: any): Promise<void> {
	const table = process.env.TABLE_BEATMAP;
	
	const client = await pool.connect();
	try {
		await client.query(`
			INSERT INTO public.${table} (
				id, beatmapset_id, mode, status, version, creator, user_id,
				difficulty_rating, cs, ar, od, hp,
				count_circles, count_sliders, count_spinners, max_combo,
				bpm, total_length, hit_length,
				checksum, last_updated, url,
				playcount, passcount, is_scoreable
			) VALUES (
				$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
			)
			ON CONFLICT (id) DO UPDATE SET
				beatmapset_id = EXCLUDED.beatmapset_id,
				mode = EXCLUDED.mode,
				status = EXCLUDED.status,
				version = EXCLUDED.version,
				creator = EXCLUDED.creator,
				user_id = EXCLUDED.user_id,
				difficulty_rating = EXCLUDED.difficulty_rating,
				cs = EXCLUDED.cs,
				ar = EXCLUDED.ar,
				od = EXCLUDED.od,
				hp = EXCLUDED.hp,
				count_circles = EXCLUDED.count_circles,
				count_sliders = EXCLUDED.count_sliders,
				count_spinners = EXCLUDED.count_spinners,
				max_combo = EXCLUDED.max_combo,
				bpm = EXCLUDED.bpm,
				total_length = EXCLUDED.total_length,
				hit_length = EXCLUDED.hit_length,
				checksum = EXCLUDED.checksum,
				last_updated = EXCLUDED.last_updated,
				url = EXCLUDED.url,
				playcount = EXCLUDED.playcount,
				passcount = EXCLUDED.passcount,
				is_scoreable = EXCLUDED.is_scoreable
		`, [
			beatmap.id, beatmap.beatmapset_id, beatmap.mode, beatmap.status, beatmap.version,
			beatmap.creator, beatmap.user_id,
			beatmap.difficulty_rating, beatmap.cs, beatmap.ar, beatmap.od, beatmap.hp,
			beatmap.count_circles, beatmap.count_sliders, beatmap.count_spinners, beatmap.max_combo,
			beatmap.bpm, beatmap.total_length, beatmap.hit_length,
			beatmap.checksum, beatmap.last_updated, beatmap.url,
			beatmap.playcount, beatmap.passcount, beatmap.is_scoreable
		]);
	} catch (err) {
        console.error('Failed to insert beatmap:', err instanceof Error ? err.message : err);
        throw err;
	} finally {
		client.release();
	}
}

// Insert or update a beatmapset row
async function insertBeatmapset(beatmapset: any): Promise<void> {
	const table = process.env.TABLE_BEATMAPSET;

	const client = await pool.connect();
	try {
		await client.query(`
			INSERT INTO public.${table} (
				id, status, title, title_unicode, artist, artist_unicode, 
				creator, user_id, source, tags,
				beatmap_count, osu, taiko, fruits, mania,
				bpm,
				submitted, updated, ranked, loved, approved,
				genre_id, language_id,
				missing_audio, deleted, downloaded, file_size
			) VALUES (
				$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
			)
			ON CONFLICT (id) DO UPDATE SET
				status = EXCLUDED.status,
				title = EXCLUDED.title,
				title_unicode = EXCLUDED.title_unicode,
				artist = EXCLUDED.artist,
				artist_unicode = EXCLUDED.artist_unicode,
				creator = EXCLUDED.creator,
				user_id = EXCLUDED.user_id,
				source = EXCLUDED.source,
				tags = EXCLUDED.tags,
				beatmap_count = EXCLUDED.beatmap_count,
				osu = EXCLUDED.osu,
				taiko = EXCLUDED.taiko,
				fruits = EXCLUDED.fruits,
				mania = EXCLUDED.mania,
				bpm = EXCLUDED.bpm,
				submitted = EXCLUDED.submitted,
				updated = EXCLUDED.updated,
				ranked = EXCLUDED.ranked,
				loved = EXCLUDED.loved,
				approved = EXCLUDED.approved,
				genre_id = EXCLUDED.genre_id,
				language_id = EXCLUDED.language_id,
				missing_audio = EXCLUDED.missing_audio,
				deleted = EXCLUDED.deleted,
				downloaded = EXCLUDED.downloaded,
				file_size = EXCLUDED.file_size
			`, [
				beatmapset.id, beatmapset.status, 
				beatmapset.title, beatmapset.title_unicode,
				beatmapset.artist, beatmapset.artist_unicode,
				beatmapset.creator, beatmapset.user_id, 
				beatmapset.source, beatmapset.tags,
				beatmapset.beatmaps?.length ?? 0, 
				beatmapset.osu, beatmapset.taiko, beatmapset.fruits, beatmapset.mania,
				beatmapset.bpm,
				beatmapset.submitted_date, beatmapset.last_updated, beatmapset.ranked_date,
				beatmapset.loved_date, beatmapset.approved_date,
				beatmapset.genre?.id, beatmapset.language?.id,
				beatmapset.availability?.download_disabled ?? false,
				beatmapset.deleted ?? false,
				beatmapset.downloaded ?? false,
				beatmapset.file_size ?? null
			]
		);
	} catch (err) {
		console.error(err);
	} finally {
		client.release();
	}
}

async function beatmapsetExists(id: number): Promise<boolean> {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT 1 FROM public.${process.env.TABLE_BEATMAPSET}
            WHERE id = $1
            ORDER BY id ASC
        `, [id]);
        return (res.rowCount ?? 0) > 0;
    } finally {
        client.release();
    }
}

async function beatmapExists(id: number): Promise<boolean | null> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT 1 FROM ${process.env.TABLE_BEATMAP} WHERE id = $1 ORDER BY id ASC LIMIT 1`,
            [id]
        );
        return (res.rowCount ?? 0) > 0;
    } catch (err) {
        console.error(err);
        return null;
    } finally {
        client.release();
    }
}

async function getBeatmapsetById(id: number): Promise<any | null> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT * FROM ${process.env.TABLE_BEATMAPSET} WHERE id = $1 ORDER BY id ASC`,
            [id]
        );
        return res.rows[0] || null;
    } finally {
        client.release();
    }
}

async function getHighestBeatmapsetId(): Promise<number | null> {
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

interface DatabaseStats {
    last_beatmapset_id: number;
    beatmapset_count: number;
    beatmap_count: number;
    ranked_count: number;
    approved_count: number;
    loved_count: number;
    graveyard_count: number;
    pending_count: number;
}

async function updateStats(): Promise<DatabaseStats | null> {
    console.log("Updating Stats Table...");
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
	  
		// Use a simpler query structure with one row of aggregates
		const res = await client.query(`
			SELECT
				(SELECT COALESCE(MAX(id), 0) FROM public.${tableBeatmapset}) AS last_beatmapset_id,
				(SELECT COUNT(*) FROM public.${tableBeatmapset}) AS beatmapset_count,
				(SELECT COUNT(*) FROM public.${tableBeatmap}) AS beatmap_count,
				(SELECT COUNT(*) FROM public.${tableBeatmapset} WHERE status = 1) AS ranked_count,
				(SELECT COUNT(*) FROM public.${tableBeatmapset} WHERE status = 2) AS approved_count,
				(SELECT COUNT(*) FROM public.${tableBeatmapset} WHERE status = 4) AS loved_count,
				(SELECT COUNT(*) FROM public.${tableBeatmapset} WHERE status = -2) AS graveyard_count,
				(SELECT COUNT(*) FROM public.${tableBeatmapset} WHERE status IN (-1,0,3)) AS pending_count,
				(SELECT COALESCE(SUM(file_size), 0) FROM public.${tableBeatmapset} WHERE downloaded = true AND file_size IS NOT NULL) AS total_size;
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
				pending_count = $8,
				total_size = $9
		`, [
		  stats.last_beatmapset_id,
		  stats.beatmapset_count,
		  stats.beatmap_count,
		  stats.ranked_count,
		  stats.approved_count,
		  stats.loved_count,
		  stats.graveyard_count,
		  stats.pending_count,
		  stats.total_size
		]);
		return stats;
	} catch (err) {
  		console.error(err);
  		return null;
	} finally {
		client.release();
	}
}

async function markBeatmapsetDownloaded(id: number, downloaded: boolean = true): Promise<void> {
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

async function markBeatmapsetDeleted(id: number, deleted: boolean = true): Promise<void> {
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

async function markBeatmapsetMissingAudio(id: number, missingAudio: boolean = true): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE ${process.env.TABLE_BEATMAPSET} SET missing_audio = $1 WHERE id = $2`,
            [missingAudio, id]
        );
    } finally {
        client.release();
    }
}

export {
	insertBeatmap,
	insertBeatmapset,
	beatmapsetExists,
	beatmapExists,
	getHighestBeatmapsetId,
	updateStats,
	getBeatmapsetById,
	markBeatmapsetDeleted,
	markBeatmapsetDownloaded,
    markBeatmapsetMissingAudio
};
