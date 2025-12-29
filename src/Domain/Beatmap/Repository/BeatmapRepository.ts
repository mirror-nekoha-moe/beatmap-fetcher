import { createPool } from '@Core/Database/Connection';
import { Beatmap } from '@Domain/Beatmap/Model/BeatmapModel';
import { Environment } from '@Bootstrap/Environment';

const pool = createPool();

export class BeatmapRepository {
    static async insertBeatmap(beatmap: Beatmap): Promise<void> {
        await pool.query(`
            INSERT INTO public.${Environment.env.TABLE_BEATMAP} (
                accuracy,
                ar,
                beatmapset_id,
                bpm,
                checksum,
                convert,
                count_circles,
                count_sliders,
                count_spinners,
                cs,
                deleted_at,
                difficulty_rating,
                drain,
                hit_length,
                id,
                is_scoreable,
                last_updated,
                max_combo,
                mode,
                mode_int,
                passcount,
                playcount,
                status,
                total_length,
                url,
                user_id,
                version
            ) VALUES (
                $1,$2,$3,$4,$5,
                $6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,
                $16,$17,$18,$19,$20,
                $21,$22,$23,$24,$25,
                $26,$27
            )
            ON CONFLICT (id) DO UPDATE SET
                accuracy = EXCLUDED.accuracy,
                ar = EXCLUDED.ar,
                beatmapset_id = EXCLUDED.beatmapset_id,
                bpm = EXCLUDED.bpm,
                checksum = EXCLUDED.checksum,
                convert = EXCLUDED.convert,
                count_circles = EXCLUDED.count_circles,
                count_sliders = EXCLUDED.count_sliders,
                count_spinners = EXCLUDED.count_spinners,
                cs = EXCLUDED.cs,
                deleted_at = EXCLUDED.deleted_at,
                difficulty_rating = EXCLUDED.difficulty_rating,
                drain = EXCLUDED.drain,
                hit_length = EXCLUDED.hit_length,
                is_scoreable = EXCLUDED.is_scoreable,
                last_updated = EXCLUDED.last_updated,
                max_combo = EXCLUDED.max_combo,
                mode = EXCLUDED.mode,
                mode_int = EXCLUDED.mode_int,
                passcount = EXCLUDED.passcount,
                playcount = EXCLUDED.playcount,
                status = EXCLUDED.status,
                total_length = EXCLUDED.total_length,
                url = EXCLUDED.url,
                user_id = EXCLUDED.user_id,
                version = EXCLUDED.version
        `, [
            beatmap.accuracy,
            beatmap.ar,
            beatmap.beatmapset_id,
            beatmap.bpm,
            beatmap.checksum,
            beatmap.convert,
            beatmap.count_circles,
            beatmap.count_sliders,
            beatmap.count_spinners,
            beatmap.cs,
            beatmap.deleted_at,
            beatmap.difficulty_rating,
            beatmap.drain,
            beatmap.hit_length,
            beatmap.id,
            beatmap.is_scoreable,
            beatmap.last_updated,
            beatmap.max_combo,
            beatmap.mode,
            beatmap.mode_int,
            beatmap.passcount,
            beatmap.playcount,
            beatmap.status,
            beatmap.total_length,
            beatmap.url,
            beatmap.user_id,
            beatmap.version
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