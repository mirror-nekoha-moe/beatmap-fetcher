import { createPool } from 'Core/Database/Connection';
import { Tables } from 'Core/Database/Tables';
import { Beatmapset } from 'Domain/Beatmapset/Model';

const pool = createPool();

export class BeatmapsetRepository {
    static async insertBeatmapset(beatmapset: Beatmapset): Promise<void> {
        await pool.query(`
            INSERT INTO public.${Tables.BEATMAPSET} (
                id, anime_cover, artist, artist_unicode,
                more_information, download_disabled,
                bpm,
                cover, cover_2x, card, card_2x, list, list_2x, slimcover, slimcover_2x,
                creator, deleted_at, description, favourite_count, genre_id,
                is_scoreable, language_id, last_updated, nsfw, offset, playcount, preview_url,
                ranked_date, rating,
                source, spotlight, status, storyboard,
                submitted_date,
                tags, title, title_unicode, user_id, video,
                beatmap_count, mode_osu_count, mode_taiko_count, mode_fruits_count, mode_mania_count,
                downloaded, file_size
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,
                $8,$9,$10,$11,$12,$13,$14,$15,
                $16,$17,$18,$19,$20,
                $21,$22,$23,$24,$25,$26,$27,
                $28,$29,
                $30,$31,$32,$33,
                $34,
                $35,$36,$37,$38,$39,
                $40,$41,$42,$43,$44
            )
            ON CONFLICT (id) DO UPDATE SET
                anime_cover = EXCLUDED.anime_cover,
                artist = EXCLUDED.artist,
                artist_unicode = EXCLUDED.artist_unicode,
                more_information = EXCLUDED.more_information,
                download_disabled = EXCLUDED.download_disabled,
                bpm = EXCLUDED.bpm,
                cover = EXCLUDED.cover,
                cover_2x = EXCLUDED.cover_2x,
                card = EXCLUDED.card,
                card_2x = EXCLUDED.card_2x,
                list = EXCLUDED.list,
                list_2x = EXCLUDED.list_2x,
                slimcover = EXCLUDED.slimcover,
                slimcover_2x = EXCLUDED.slimcover_2x,
                creator = EXCLUDED.creator,
                deleted_at = EXCLUDED.deleted_at,
                description = EXCLUDED.description,
                favourite_count = EXCLUDED.favourite_count,
                genre_id = EXCLUDED.genre_id,
                is_scoreable = EXCLUDED.is_scoreable,
                language_id = EXCLUDED.language_id,
                last_updated = EXCLUDED.last_updated,
                nsfw = EXCLUDED.nsfw,
                offset = EXCLUDED.offset,
                playcount = EXCLUDED.playcount,
                preview_url = EXCLUDED.preview_url,
                ranked_date = EXCLUDED.ranked_date,
                rating = EXCLUDED.rating,
                source = EXCLUDED.source,
                spotlight = EXCLUDED.spotlight,
                status = EXCLUDED.status,
                storyboard = EXCLUDED.storyboard,
                submitted_date = EXCLUDED.submitted_date,
                tags = EXCLUDED.tags,
                title = EXCLUDED.title,
                title_unicode = EXCLUDED.title_unicode,
                user_id = EXCLUDED.user_id,
                video = EXCLUDED.video,
                beatmap_count = EXCLUDED.beatmap_count,
                mode_osu_count = EXCLUDED.mode_osu_count,
                mode_taiko_count = EXCLUDED.mode_taiko_count,
                mode_fruits_count = EXCLUDED.mode_fruits_count,
                mode_mania_count = EXCLUDED.mode_mania_count,
                downloaded = EXCLUDED.downloaded,
                file_size = EXCLUDED.file_size
        `, [
            beatmapset.id,
            beatmapset.anime_cover,
            beatmapset.artist,
            beatmapset.artist_unicode,
            beatmapset.more_information,
            beatmapset.download_disabled,
            beatmapset.bpm,
            beatmapset.cover,
            beatmapset.cover_2x,
            beatmapset.card,
            beatmapset.card_2x,
            beatmapset.list,
            beatmapset.list_2x,
            beatmapset.slimcover,
            beatmapset.slimcover_2x,
            beatmapset.creator,
            beatmapset.deleted_at,
            beatmapset.description,
            beatmapset.favourite_count,
            beatmapset.genre_id,
            beatmapset.is_scoreable,
            beatmapset.language_id,
            beatmapset.last_updated,
            beatmapset.nsfw,
            beatmapset.offset,
            beatmapset.playcount,
            beatmapset.preview_url,
            beatmapset.ranked_date,
            beatmapset.rating,
            beatmapset.source,
            beatmapset.spotlight,
            beatmapset.status,
            beatmapset.storyboard,
            beatmapset.submitted_date,
            beatmapset.tags,
            beatmapset.title,
            beatmapset.title_unicode,
            beatmapset.user_id,
            beatmapset.video,
            beatmapset.beatmap_count,
            beatmapset.mode_osu_count,
            beatmapset.mode_taiko_count,
            beatmapset.mode_fruits_count,
            beatmapset.mode_mania_count,
            beatmapset.downloaded,
            beatmapset.file_size
        ]);
    }

    static async beatmapsetExists(id: number): Promise<boolean> {
        const res = await pool.query(
            `SELECT 1 FROM public.${Tables.BEATMAPSET} WHERE id = $1 LIMIT 1`,
            [id]
        );
        return res.rowCount === 1;
    }

    static async getBeatmapsetById(id: number): Promise<Beatmapset | null> {
        const res = await pool.query(
            `SELECT * FROM public.${Tables.BEATMAPSET} WHERE id = $1`,
            [id]
        );
        return res.rows[0] ?? null;
    }

    static async getHighestBeatmapsetId(): Promise<number> {
        const res = await pool.query(
            `SELECT COALESCE(MAX(id), 0) AS max FROM public.${Tables.BEATMAPSET}`
        );
        return res.rows[0].max;
    }

    static async getMissingBeatmapsets(): Promise<{ id: number }[]> {
        const res = await pool.query(
            `SELECT id FROM public.${Tables.BEATMAPSET} WHERE downloaded = false ORDER BY id ASC`
        );
        return res.rows;
    }

    static async getMissingMetadata(): Promise<{ id: number }[]> {
        const res = await pool.query(
            `SELECT id FROM public.${Tables.BEATMAPSET} WHERE user_id IS NULL ORDER BY id ASC`
        );
        return res.rows;
    }

    // -----------------------------------------------------
    // Flags
    // -----------------------------------------------------

    static async markBeatmapsetDownloaded(id: number, value = true): Promise<void> {
        await pool.query(
            `UPDATE public.${Tables.BEATMAPSET} SET downloaded = $1 WHERE id = $2`,
            [value, id]
        );
    }

    static async markBeatmapsetDeleted(id: number, value = true): Promise<void> {
        await pool.query(
            `UPDATE public.${Tables.BEATMAPSET} SET deleted = $1 WHERE id = $2`,
            [value, id]
        );
    }

    static async markBeatmapsetMissingAudio(id: number, value = true): Promise<void> {
        await pool.query(
            `UPDATE public.${Tables.BEATMAPSET} SET missing_audio = $1 WHERE id = $2`,
            [value, id]
        );
    }
}