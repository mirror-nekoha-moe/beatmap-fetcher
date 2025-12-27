import { createPool } from '@Core/Database/Connection';
import { Beatmap } from '@Domain/Beatmap/Model/BeatmapModel';
import { Environment } from '@Bootstrap/Environment';

const pool = createPool();

export class BeatmapRepository {
    static async insertBeatmap(beatmap: Beatmap): Promise<void> {
        await pool.query(`
            INSERT INTO public.${Environment.env.TABLE_BEATMAP} (
                id, beatmapset_id, mode, mode_int, status, version, user_id,
                difficulty_rating, cs, ar, drain, accuracy,
                count_circles, count_sliders, count_spinners, max_combo,
                bpm, total_length, hit_length, checksum, last_updated, url,
                playcount, passcount, is_scoreable, convert, deleted_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
                $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
                $23,$24,$25,$26,$27
            )
            ON CONFLICT (id) DO UPDATE SET
                beatmapset_id = EXCLUDED.beatmapset_id,
                mode = EXCLUDED.mode,
                mode_int = EXCLUDED.mode_int,
                status = EXCLUDED.status,
                version = EXCLUDED.version,
                user_id = EXCLUDED.user_id,
                difficulty_rating = EXCLUDED.difficulty_rating,
                cs = EXCLUDED.cs,
                ar = EXCLUDED.ar,
                drain = EXCLUDED.drain,
                accuracy = EXCLUDED.accuracy,
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
                is_scoreable = EXCLUDED.is_scoreable,
                convert = EXCLUDED.convert,
                deleted_at = EXCLUDED.deleted_at
        `, [
            beatmap.id,
            beatmap.beatmapset_id,
            beatmap.mode,
            beatmap.mode_int,
            beatmap.status,
            beatmap.version,
            beatmap.user_id,
            beatmap.difficulty_rating,
            beatmap.cs,
            beatmap.ar,
            beatmap.drain,
            beatmap.accuracy,
            beatmap.count_circles,
            beatmap.count_sliders,
            beatmap.count_spinners,
            beatmap.max_combo,
            beatmap.bpm,
            beatmap.total_length,
            beatmap.hit_length,
            beatmap.checksum,
            beatmap.last_updated,
            beatmap.url,
            beatmap.playcount,
            beatmap.passcount,
            beatmap.is_scoreable,
            beatmap.convert,
            beatmap.deleted_at
        ]);
    }

    static async beatmapExists(id: number): Promise<boolean> {
        const res = await pool.query(
            `SELECT 1 FROM public.${Environment.env.TABLE_BEATMAP} WHERE id = $1 LIMIT 1`,
            [id]
        );
        return res.rowCount === 1;
    }
}