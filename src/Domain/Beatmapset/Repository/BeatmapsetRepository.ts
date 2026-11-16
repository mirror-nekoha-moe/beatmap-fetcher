import { createPool } from '@Core/Database/Connection';
import { Beatmapset } from '@Domain/Beatmapset/Model/BeatmapsetModel';
import { Environment } from '@Bootstrap/Environment';
import { DatabaseHelper } from '@Core/Database/Helper';

const pool = createPool();

export class BeatmapsetRepository {
    static async insertBeatmapset(beatmapset: Beatmapset): Promise<void> {
        await pool.query(`
            INSERT INTO public.${Environment.env.TABLE_BEATMAPSET} (
                anime_cover,
                artist,
                artist_unicode,
                beatmap_count,
                bpm,
                can_be_hyped,
                card,
                card_2x,
                converts,
                cover,
                cover_2x,
                creator,
                current_nominations,
                deleted_at,
                description,
                discussion_enabled,
                discussion_locked,
                download_disabled,
                downloaded,
                favourite_count,
                file_size,
                genre_id,
                hype,
                id,
                is_scoreable,
                language_id,
                last_updated,
                legacy_thread_url,
                list,
                list_2x,
                mode_fruits_count,
                mode_mania_count,
                mode_osu_count,
                mode_taiko_count,
                more_information,
                nominations_summary,
                nsfw,
                "offset",
                pack_tags,
                playcount,
                preview_url,
                ranked_date,
                rating,
                ratings,
                recent_favourites,
                related_tags,
                related_users,
                slimcover,
                slimcover_2x,
                source,
                spotlight,
                status,
                storyboard,
                submitted_date,
                tags,
                title,
                title_unicode,
                track_id,
                "user",
                user_id,
                version_count,
                video
            ) VALUES (
                $1,$2,$3,$4,$5,
                $6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,
                $16,$17,$18,$19,$20,
                $21,$22,$23,$24,$25,
                $26,$27,$28,$29,$30,
                $31,$32,$33,$34,$35,
                $36,$37,$38,$39,$40,
                $41,$42,$43,$44,$45,
                $46,$47,$48,$49,$50,
                $51,$52,$53,$54,$55,
                $56,$57,$58,$59,$60,
                $61,$62
            )
            ON CONFLICT (id) DO UPDATE SET
                anime_cover = EXCLUDED.anime_cover,
                artist = EXCLUDED.artist,
                artist_unicode = EXCLUDED.artist_unicode,
                beatmap_count = EXCLUDED.beatmap_count,
                bpm = EXCLUDED.bpm,
                can_be_hyped = EXCLUDED.can_be_hyped,
                card = EXCLUDED.card,
                card_2x = EXCLUDED.card_2x,
                converts = EXCLUDED.converts,
                cover = EXCLUDED.cover,
                cover_2x = EXCLUDED.cover_2x,
                creator = EXCLUDED.creator,
                current_nominations = EXCLUDED.current_nominations,
                deleted_at = EXCLUDED.deleted_at,
                description = EXCLUDED.description,
                discussion_enabled = EXCLUDED.discussion_enabled,
                discussion_locked = EXCLUDED.discussion_locked,
                download_disabled = EXCLUDED.download_disabled,
                downloaded = EXCLUDED.downloaded,
                favourite_count = EXCLUDED.favourite_count,
                file_size = EXCLUDED.file_size,
                genre_id = EXCLUDED.genre_id,
                hype = EXCLUDED.hype,
                is_scoreable = EXCLUDED.is_scoreable,
                language_id = EXCLUDED.language_id,
                last_updated = EXCLUDED.last_updated,
                legacy_thread_url = EXCLUDED.legacy_thread_url,
                list = EXCLUDED.list,
                list_2x = EXCLUDED.list_2x,
                mode_fruits_count = EXCLUDED.mode_fruits_count,
                mode_mania_count = EXCLUDED.mode_mania_count,
                mode_osu_count = EXCLUDED.mode_osu_count,
                mode_taiko_count = EXCLUDED.mode_taiko_count,
                more_information = EXCLUDED.more_information,
                nominations_summary = EXCLUDED.nominations_summary,
                nsfw = EXCLUDED.nsfw,
                "offset" = EXCLUDED."offset",
                pack_tags = EXCLUDED.pack_tags,
                playcount = EXCLUDED.playcount,
                preview_url = EXCLUDED.preview_url,
                ranked_date = EXCLUDED.ranked_date,
                rating = EXCLUDED.rating,
                ratings = EXCLUDED.ratings,
                recent_favourites = EXCLUDED.recent_favourites,
                related_tags = EXCLUDED.related_tags,
                related_users = EXCLUDED.related_users,
                slimcover = EXCLUDED.slimcover,
                slimcover_2x = EXCLUDED.slimcover_2x,
                source = EXCLUDED.source,
                spotlight = EXCLUDED.spotlight,
                status = EXCLUDED.status,
                storyboard = EXCLUDED.storyboard,
                submitted_date = EXCLUDED.submitted_date,
                tags = EXCLUDED.tags,
                title = EXCLUDED.title,
                title_unicode = EXCLUDED.title_unicode,
                track_id = EXCLUDED.track_id,
                "user" = EXCLUDED."user",
                user_id = EXCLUDED.user_id,
                version_count = EXCLUDED.version_count,
                video = EXCLUDED.video
        `, [
            beatmapset.anime_cover,
            beatmapset.artist,
            beatmapset.artist_unicode,
            beatmapset.beatmap_count,
            beatmapset.bpm,
            beatmapset.can_be_hyped,
            beatmapset.card,
            beatmapset.card_2x,
            DatabaseHelper.toJsonb(beatmapset.converts),
            beatmapset.cover,
            beatmapset.cover_2x,
            beatmapset.creator,
            DatabaseHelper.toJsonb(beatmapset.current_nominations),
            beatmapset.deleted_at,
            beatmapset.description,
            beatmapset.discussion_enabled,
            beatmapset.discussion_locked,
            beatmapset.download_disabled,
            beatmapset.downloaded,
            beatmapset.favourite_count,
            beatmapset.file_size,
            beatmapset.genre_id,
            DatabaseHelper.toJsonb(beatmapset.hype),
            beatmapset.id,
            beatmapset.is_scoreable,
            beatmapset.language_id,
            beatmapset.last_updated,
            beatmapset.legacy_thread_url,
            beatmapset.list,
            beatmapset.list_2x,
            beatmapset.mode_fruits_count,
            beatmapset.mode_mania_count,
            beatmapset.mode_osu_count,
            beatmapset.mode_taiko_count,
            beatmapset.more_information,
            DatabaseHelper.toJsonb(beatmapset.nominations_summary),
            beatmapset.nsfw,
            beatmapset.offset,
            DatabaseHelper.toJsonb(beatmapset.pack_tags),
            beatmapset.playcount,
            beatmapset.preview_url,
            beatmapset.ranked_date,
            beatmapset.rating,
            DatabaseHelper.toJsonb(beatmapset.ratings),
            DatabaseHelper.toJsonb(beatmapset.recent_favourites),
            DatabaseHelper.toJsonb(beatmapset.related_tags),
            DatabaseHelper.toJsonb(beatmapset.related_users),
            beatmapset.slimcover,
            beatmapset.slimcover_2x,
            beatmapset.source,
            beatmapset.spotlight,
            beatmapset.status,
            beatmapset.storyboard,
            beatmapset.submitted_date,
            beatmapset.tags,
            beatmapset.title,
            beatmapset.title_unicode,
            beatmapset.track_id,
            DatabaseHelper.toJsonb(beatmapset.user),
            beatmapset.user_id,
            beatmapset.version_count,
            beatmapset.video
        ]);
    }

    static async updateDownloadState(id: bigint, downloaded: boolean, fileSize: bigint | null): Promise<void> {
        await pool.query(`
            UPDATE public.${Environment.env.TABLE_BEATMAPSET} SET
            downloaded = $2,
            file_size = $3
            WHERE id = $1
            `,
            [
                id,
                downloaded,
                fileSize !== null ? fileSize.toString() : null
            ]
        );
    }


    static async beatmapsetExists(id: number): Promise<boolean> {
        const res = await pool.query(
            `SELECT 1 FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE id = $1 LIMIT 1`,
            [id]
        );
        return res.rowCount === 1;
    }

    static async getBeatmapsetById(id: number): Promise<Beatmapset | null> {
        const res = await pool.query(
            `SELECT * FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE id = $1`,
            [id]
        );
        return res.rows[0] ?? null;
    }

    static async getAllBeatmapset(): Promise<number[]> {
        const res = await pool.query(
            `SELECT id FROM public.${Environment.env.TABLE_BEATMAPSET} ORDER BY id ASC`
        );
        
        return res.rows.map(r => Number(r.id));
    }

    static async getQualifiedBeatmapsetIds(): Promise<number[]> {
        const res = await pool.query(
            `SELECT id FROM public.${Environment.env.TABLE_BEATMAPSET}
             WHERE status = 'qualified'
             ORDER BY id ASC`
        );
        return res.rows.map(r => Number(r.id));
    }

    static async getBeatmapsetsNeedingRefresh(): Promise<number[]> {
        const res = await pool.query(
            `SELECT id FROM public.${Environment.env.TABLE_BEATMAPSET}
             WHERE status IN ('qualified', 'pending', 'wip')
                OR downloaded = false
                OR (status IN ('ranked', 'loved', 'approved') AND last_updated >= NOW() - INTERVAL '6 months')
             ORDER BY id ASC`
        );
        return res.rows.map(r => Number(r.id));
    }

    static async getHighestBeatmapsetId(): Promise<number> {
        const res = await pool.query(
            `SELECT COALESCE(MAX(id), 0) AS max FROM public.${Environment.env.TABLE_BEATMAPSET}`
        );
        return res.rows[0].max;
    }

    static async getMissingBeatmapsets(): Promise<{ id: number }[]> {
        const res = await pool.query(
            `SELECT id FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE downloaded = false ORDER BY id ASC`
        );
        return res.rows.map(r => ({ id: Number(r.id) }));
    }

    static async getMissingByStatuses(statuses: string[]): Promise<{ id: number }[]> {
        const placeholders = statuses.map((_, i) => `$${i + 1}`).join(', ');
        const res = await pool.query(
            `SELECT id FROM public.${Environment.env.TABLE_BEATMAPSET}
             WHERE downloaded = false
               AND status IN (${placeholders})
             ORDER BY id ASC`,
            statuses
        );
        return res.rows.map(r => ({ id: Number(r.id) }));
    }

    static async getUndownloadedGraveyard(statuses: string[], limit: number): Promise<{ id: number }[]> {
        const res = await pool.query(
            `
                SELECT id FROM public.${Environment.env.TABLE_BEATMAPSET}
                    WHERE downloaded = false
                        AND download_disabled = false
                        AND status = ANY($1)
                    ORDER BY playcount DESC NULLS LAST
                    LIMIT $2
            `,
            [statuses, limit]
        );
        return res.rows.map(r => ({ id: Number(r.id) }));
    }

    static async getMissingMetadata(): Promise<{ id: number }[]> {
        const res = await pool.query(
            `SELECT id FROM public.${Environment.env.TABLE_BEATMAPSET} WHERE user_id IS NULL ORDER BY id ASC`
        );
        return res.rows;
    }

    static async getFirstRankedDate(): Promise<Date | null> {
        const res = await pool.query(
            `SELECT MIN(ranked_date) AS first FROM public.${Environment.env.TABLE_BEATMAPSET}
             WHERE status IN ('ranked', 'approved', 'loved')`
        );
        return res.rows[0]?.first ?? null;
    }

    static async getRankedIdsByDate(from: Date, to: Date, modeColumn: string): Promise<number[]> {
        const res = await pool.query(
            `SELECT id FROM public.${Environment.env.TABLE_BEATMAPSET}
             WHERE status IN ('ranked', 'approved', 'loved')
               AND downloaded = true
               AND ranked_date >= $1
               AND ranked_date < $2
               AND ${modeColumn} > 0
             ORDER BY id ASC`,
            [from, to]
        );
        return res.rows.map(r => Number(r.id));
    }

    // Flags

    static async markBeatmapsetDownloaded(id: number, value = true): Promise<void> {
        await pool.query(
            `UPDATE public.${Environment.env.TABLE_BEATMAPSET} SET downloaded = $1 WHERE id = $2`,
            [value, id]
        );
    }

    // after insertBeatmapset
    static async markDownloadedVersion(id: number): Promise<void> {
        await pool.query(
            `UPDATE public.${Environment.env.TABLE_BEATMAPSET} SET downloaded_last_updated = last_updated WHERE id = $1`,
            [id]
        );
    }

    static async markDeleted(id: number, deletedAt: Date): Promise<void> {
        await pool.query(
            `UPDATE public.${Environment.env.TABLE_BEATMAPSET} SET deleted_at = $1 WHERE id = $2 AND deleted_at IS NULL`,
            [deletedAt, id]
        );
    }

    static async markDownloadDisabled(id: bigint): Promise<void> {
        await pool.query(
            `UPDATE public.${Environment.env.TABLE_BEATMAPSET} SET download_disabled = true WHERE id = $1`,
            [id]
    );
}}