import { createPool } from "@Core/Database/Connection";
import { Stats } from "@Domain/Stats/Model/StatsModel";
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
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = 'ranked') AS ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = 'approved') AS approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = 'loved') AS loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = 'graveyard') AS graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = 'wip') AS wip_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = 'qualified') AS qualified_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE status = 'pending') AS pending_count,
                    (SELECT COALESCE(SUM(file_size),0) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = true AND file_size IS NOT NULL) AS total_size,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'ranked') AS bm_ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'approved') AS bm_approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'loved') AS bm_loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'graveyard') AS bm_graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'wip') AS bm_wip_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'qualified') AS bm_qualified_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'pending') AS bm_pending_count,
                    
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = false) AS missing_beatmapsets,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = false AND status = 'ranked') AS missing_beatmapsets_ranked,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = false AND status = 'approved') AS missing_beatmapsets_approved,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = false AND status = 'loved') AS missing_beatmapsets_loved,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = false AND status = 'graveyard') AS missing_beatmapsets_graveyard,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = false AND status = 'pending') AS missing_beatmapsets_pending,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = false AND status = 'wip') AS missing_beatmapsets_wip,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = false AND status = 'qualified') AS missing_beatmapsets_qualified,

                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'ranked' AND mode_int = 0) AS osu_bm_ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'approved' AND mode_int = 0) AS osu_bm_approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'loved' AND mode_int = 0) AS osu_bm_loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'graveyard' AND mode_int = 0) AS osu_bm_graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'wip' AND mode_int = 0) AS osu_bm_wip_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'qualified' AND mode_int = 0) AS osu_bm_qualified_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'pending' AND mode_int = 0) AS osu_bm_pending_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'ranked' AND mode_int = 1) AS taiko_bm_ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'approved' AND mode_int = 1) AS taiko_bm_approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'loved' AND mode_int = 1) AS taiko_bm_loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'graveyard' AND mode_int = 1) AS taiko_bm_graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'wip' AND mode_int = 1) AS taiko_bm_wip_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'qualified' AND mode_int = 1) AS taiko_bm_qualified_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'pending' AND mode_int = 1) AS taiko_bm_pending_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'ranked' AND mode_int = 2) AS fruits_bm_ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'approved' AND mode_int = 2) AS fruits_bm_approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'loved' AND mode_int = 2) AS fruits_bm_loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'graveyard' AND mode_int = 2) AS fruits_bm_graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'wip' AND mode_int = 2) AS fruits_bm_wip_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'qualified' AND mode_int = 2) AS fruits_bm_qualified_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'pending' AND mode_int = 2) AS fruits_bm_pending_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'ranked' AND mode_int = 3) AS mania_bm_ranked_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'approved' AND mode_int = 3) AS mania_bm_approved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'loved' AND mode_int = 3) AS mania_bm_loved_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'graveyard' AND mode_int = 3) AS mania_bm_graveyard_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'wip' AND mode_int = 3) AS mania_bm_wip_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'qualified' AND mode_int = 3) AS mania_bm_qualified_count,
                    (SELECT COUNT(*) FROM public.${Environment.env.TABLE_BEATMAP} WHERE status = 'pending' AND mode_int = 3) AS mania_bm_pending_count
            `);

            const stats = res.rows[0];

            await client.query(`
                UPDATE public.${Environment.env.TABLE_STATS} SET
                    last_beatmapset_id = $1,
                    beatmapset_count = $2,
                    beatmap_count = $3,
                    ranked_count = $4,
                    approved_count = $5,
                    loved_count = $6,
                    graveyard_count = $7,
                    wip_count = $8,
                    qualified_count = $9,
                    pending_count = $10,
                    total_size = $11,
                    bm_ranked_count = $12,
                    bm_approved_count = $13,
                    bm_loved_count = $14,
                    bm_graveyard_count = $15,
                    bm_wip_count = $16,
                    bm_qualified_count = $17,
                    bm_pending_count = $18,
                    missing_beatmapsets = $19,
                    missing_beatmapsets_ranked = $20,
                    missing_beatmapsets_approved = $21,
                    missing_beatmapsets_loved = $22,
                    missing_beatmapsets_graveyard = $23,
                    missing_beatmapsets_pending = $24,
                    missing_beatmapsets_wip = $25,
                    missing_beatmapsets_qualified = $26,
                    osu_bm_ranked_count = $27,
                    osu_bm_approved_count = $28,
                    osu_bm_loved_count = $29,
                    osu_bm_graveyard_count = $30,
                    osu_bm_wip_count = $31,
                    osu_bm_qualified_count = $32,
                    osu_bm_pending_count = $33,
                    taiko_bm_ranked_count = $34,
                    taiko_bm_approved_count = $35,
                    taiko_bm_loved_count = $36,
                    taiko_bm_graveyard_count = $37,
                    taiko_bm_wip_count = $38,
                    taiko_bm_qualified_count = $39,
                    taiko_bm_pending_count = $40,
                    fruits_bm_ranked_count = $41,
                    fruits_bm_approved_count = $42,
                    fruits_bm_loved_count = $43,
                    fruits_bm_graveyard_count = $44,
                    fruits_bm_wip_count = $45,
                    fruits_bm_qualified_count = $46,
                    fruits_bm_pending_count = $47,
                    mania_bm_ranked_count = $48,
                    mania_bm_approved_count = $49,
                    mania_bm_loved_count = $50,
                    mania_bm_graveyard_count = $51,
                    mania_bm_wip_count = $52,
                    mania_bm_qualified_count = $53,
                    mania_bm_pending_count = $54
            `, [
                stats.last_beatmapset_id,
                stats.beatmapset_count,
                stats.beatmap_count,
                stats.ranked_count,
                stats.approved_count,
                stats.loved_count,
                stats.graveyard_count,
                stats.wip_count,
                stats.qualified_count,
                stats.pending_count,
                stats.total_size,
                stats.bm_ranked_count,
                stats.bm_approved_count,
                stats.bm_loved_count,
                stats.bm_graveyard_count,
                stats.bm_wip_count,
                stats.bm_qualified_count,
                stats.bm_pending_count,
                stats.missing_beatmapsets,
                stats.missing_beatmapsets_ranked,
                stats.missing_beatmapsets_approved,
                stats.missing_beatmapsets_loved,
                stats.missing_beatmapsets_graveyard,
                stats.missing_beatmapsets_pending,
                stats.missing_beatmapsets_wip,
                stats.missing_beatmapsets_qualified,
                stats.osu_bm_ranked_count,
                stats.osu_bm_approved_count,
                stats.osu_bm_loved_count,
                stats.osu_bm_graveyard_count,
                stats.osu_bm_wip_count,
                stats.osu_bm_qualified_count,
                stats.osu_bm_pending_count,
                stats.taiko_bm_ranked_count,
                stats.taiko_bm_approved_count,
                stats.taiko_bm_loved_count,
                stats.taiko_bm_graveyard_count,
                stats.taiko_bm_wip_count,
                stats.taiko_bm_qualified_count,
                stats.taiko_bm_pending_count,
                stats.fruits_bm_ranked_count,
                stats.fruits_bm_approved_count,
                stats.fruits_bm_loved_count,
                stats.fruits_bm_graveyard_count,
                stats.fruits_bm_wip_count,
                stats.fruits_bm_qualified_count,
                stats.fruits_bm_pending_count,
                stats.mania_bm_ranked_count,
                stats.mania_bm_approved_count,
                stats.mania_bm_loved_count,
                stats.mania_bm_graveyard_count,
                stats.mania_bm_wip_count,
                stats.mania_bm_qualified_count,
                stats.mania_bm_pending_count
            ]);

            return stats;
        } catch (err) {
            console.error("Failed to update stats:", err);
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