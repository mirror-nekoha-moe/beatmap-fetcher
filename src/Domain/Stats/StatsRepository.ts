import { createPool } from "@Core/Database/Connection";
import { Stats } from "@Domain/Stats/StatsModel";
import { Environment } from "@Bootstrap/Environment";

const pool = createPool();

export class StatsRepository {
    static async updateStats(): Promise<Stats | null> {
        console.log("Updating Stats Table...");
        const client = await pool.connect();
        try {
            // Ensure stats row exists
            await client.query(`
                INSERT INTO public.${Environment.env.TABLE_STATS} (last_beatmapset_id)
                SELECT 0
                WHERE NOT EXISTS (SELECT 1 FROM public.${Environment.env.TABLE_STATS})
            `);

            const res = await client.query(`
                SELECT
                    (SELECT COALESCE(MAX(id), 0) FROM public.${Environment.env.TABLE_BEATMAPSET}) AS last_beatmapset_id,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET}) AS beatmapset_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP}) AS beatmap_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = 1) AS ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = 2) AS approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = 4) AS loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = -2) AS graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status IN (-1,0,3)) AS pending_count,
                    (SELECT COALESCE(SUM(file_size),0) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = true AND file_size IS NOT NULL) AS total_size,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 1) AS bm_ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 2) AS bm_approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 4) AS bm_loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = -2) AS bm_graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status IN (-1,0,3)) AS bm_pending_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = false) AS missing_beatmapsets,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 1 AND mode = 0) AS osu_bm_ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 2 AND mode = 0) AS osu_bm_approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 4 AND mode = 0) AS osu_bm_loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = -2 AND mode = 0) AS osu_bm_graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status IN (-1,0,3) AND mode = 0) AS osu_bm_pending_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 1 AND mode = 1) AS taiko_bm_ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 2 AND mode = 1) AS taiko_bm_approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 4 AND mode = 1) AS taiko_bm_loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = -2 AND mode = 1) AS taiko_bm_graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status IN (-1,0,3) AND mode = 1) AS taiko_bm_pending_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 1 AND mode = 2) AS fruits_bm_ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 2 AND mode = 2) AS fruits_bm_approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 4 AND mode = 2) AS fruits_bm_loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = -2 AND mode = 2) AS fruits_bm_graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status IN (-1,0,3) AND mode = 2) AS fruits_bm_pending_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 1 AND mode = 3) AS mania_bm_ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 2 AND mode = 3) AS mania_bm_approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 4 AND mode = 3) AS mania_bm_loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = -2 AND mode = 3) AS mania_bm_graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status IN (-1,0,3) AND mode = 3) AS mania_bm_pending_count
            `);

            const stats = res.rows[0];

            // Update the stats row
            await client.query(`
                UPDATE public.${Environment.env.TABLE_STATS} SET
                    last_beatmapset_id = $1,
                    beatmapset_count = $2,
                    beatmap_count = $3,
                    ranked_count = $4,
                    approved_count = $5,
                    loved_count = $6,
                    graveyard_count = $7,
                    pending_count = $8,
                    total_size = $9,
                    bm_ranked_count = $10,
                    bm_approved_count = $11,
                    bm_loved_count = $12,
                    bm_graveyard_count = $13,
                    bm_pending_count = $14,
                    missing_beatmapsets = $15,
                    osu_bm_ranked_count = $16,
                    osu_bm_approved_count = $17,
                    osu_bm_loved_count = $18,
                    osu_bm_graveyard_count = $19,
                    osu_bm_pending_count = $20,
                    taiko_bm_ranked_count = $21,
                    taiko_bm_approved_count = $22,
                    taiko_bm_loved_count = $23,
                    taiko_bm_graveyard_count = $24,
                    taiko_bm_pending_count = $25,
                    fruits_bm_ranked_count = $26,
                    fruits_bm_approved_count = $27,
                    fruits_bm_loved_count = $28,
                    fruits_bm_graveyard_count = $29,
                    fruits_bm_pending_count = $30,
                    mania_bm_ranked_count = $31,
                    mania_bm_approved_count = $32,
                    mania_bm_loved_count = $33,
                    mania_bm_graveyard_count = $34,
                    mania_bm_pending_count = $35
            `, [
                stats.last_beatmapset_id,
                stats.beatmapset_count,
                stats.beatmap_count,
                stats.ranked_count,
                stats.approved_count,
                stats.loved_count,
                stats.graveyard_count,
                stats.pending_count,
                stats.total_size,
                stats.bm_ranked_count,
                stats.bm_approved_count,
                stats.bm_loved_count,
                stats.bm_graveyard_count,
                stats.bm_pending_count,
                stats.missing_beatmapsets,
                stats.osu_bm_ranked_count,
                stats.osu_bm_approved_count,
                stats.osu_bm_loved_count,
                stats.osu_bm_graveyard_count,
                stats.osu_bm_pending_count,
                stats.taiko_bm_ranked_count,
                stats.taiko_bm_approved_count,
                stats.taiko_bm_loved_count,
                stats.taiko_bm_graveyard_count,
                stats.taiko_bm_pending_count,
                stats.fruits_bm_ranked_count,
                stats.fruits_bm_approved_count,
                stats.fruits_bm_loved_count,
                stats.fruits_bm_graveyard_count,
                stats.fruits_bm_pending_count,
                stats.mania_bm_ranked_count,
                stats.mania_bm_approved_count,
                stats.mania_bm_loved_count,
                stats.mania_bm_graveyard_count,
                stats.mania_bm_pending_count
            ]);

            return stats;
        } catch (err) {
            console.error('Failed to update stats:', err);
            return null;
        } finally {
            client.release();
        }
    }

    static async getScanCursor(): Promise<number> {
        await pool.query(
            `
            INSERT INTO public.${Environment.env.TABLE_STATS} (scan_cursor)
            SELECT 0
            WHERE NOT EXISTS (SELECT 1 FROM public.${Environment.env.TABLE_STATS})
            `
        );

        const res = await pool.query(
            `SELECT scan_cursor FROM public.${Environment.env.TABLE_STATS} LIMIT 1`
        );
        return res.rows[0]?.scan_cursor ?? 0;
    }

    static async updateScanCursor(cursor: number): Promise<void> {
        await pool.query(
            `UPDATE public.${Environment.env.TABLE_STATS} SET scan_cursor = $1`,
            [cursor]
        );
    }
}