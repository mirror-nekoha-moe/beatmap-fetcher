import { createPool } from '@Core/Database/Connection';
import { Archive } from '@Domain/Archive/Model/ArchiveModel';
import { Environment } from '@Bootstrap/Environment';

const pool = createPool();

export class ArchiveRepository {
    static async insertArchive(archive: Archive): Promise<void> {
        await pool.query(`
            INSERT INTO public.${Environment.env.TABLE_ARCHIVE} (
                archive_date,
                mode,
                file_name,
                size_gb,
                beatmapset_count,
                created_at
            ) VALUES (
                $1,$2,$3,$4,$5,
                $6
            )
            ON CONFLICT (archive_date, mode) DO UPDATE SET
                file_name = EXCLUDED.file_name,
                size_gb = EXCLUDED.size_gb,
                beatmapset_count = EXCLUDED.beatmapset_count,
                created_at = EXCLUDED.created_at
        `, [
            archive.archive_date,
            archive.mode,
            archive.file_name,
            archive.size_gb,
            archive.beatmapset_count,
            archive.created_at
        ]);
    }

    static async getArchiveNames(): Promise<Set<string>> {
        const res = await pool.query(`
            SELECT to_char(archive_date, 'YYYY-MM') || '-' || mode AS name
            FROM public.${Environment.env.TABLE_ARCHIVE}
        `);

        const names = new Set<string>();
        for (const row of res.rows) {
            names.add(row.name);
        }
        return names;
    }
}