import { createPool } from '@Core/Database/Connection';
import { TaskQueueItem } from '@Domain/TaskQueue/Model/TaskQueueModel';

const pool = createPool();

export class TaskQueueRepository {
    static async ensureTable(): Promise<void> {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.task_queue (
                id          SERIAL PRIMARY KEY,
                task        VARCHAR(100) NOT NULL,
                params      JSONB NOT NULL DEFAULT '{}',
                status      VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                started_at  TIMESTAMPTZ NULL,
                finished_at TIMESTAMPTZ NULL,
                error       TEXT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.task_definitions (
                task        VARCHAR(100) PRIMARY KEY,
                description TEXT NOT NULL,
                params_schema JSONB NOT NULL DEFAULT '{}'
            )
        `);

        // Upsert all known tasks so the bot can discover them via SELECT
        const definitions = [
            {
                task: 'download_missing_ranked',
                description: 'Download all ranked/loved/approved beatmapsets that are missing their .osz file',
                params_schema: {},
            },
            {
                task: 'fetch_beatmapset',
                description: 'Force-fetch and process a single beatmapset from the osu! API. Use --force to re-download even if already on disk.',
                params_schema: { id: 'number (required) - beatmapset ID', force: 'bool (optional) - delete and re-download existing file' },
            },
            {
                task: 'scan_recent',
                description: 'Scan recently ranked beatmapsets for the last N days',
                params_schema: { days: 'number (optional, default 7)' },
            },
            {
                task: 'refresh_all',
                description: 'Run the full filtered beatmapset refresh pass',
                params_schema: {},
            },
            {
                task: 'sync_file_sizes',
                description: 'Scan all .osz files on disk and update file_size in the database',
                params_schema: {},
            },
        ];

        for (const def of definitions) {
            await pool.query(`
                INSERT INTO public.task_definitions (task, description, params_schema)
                VALUES ($1, $2, $3)
                ON CONFLICT (task) DO UPDATE
                    SET description = EXCLUDED.description,
                        params_schema = EXCLUDED.params_schema
            `, [def.task, def.description, JSON.stringify(def.params_schema)]);
        }
    }

    /**
     * Atomically claim the next pending task.
     * Returns null if nothing is pending.
     */
    static async claimNext(): Promise<TaskQueueItem | null> {
        const res = await pool.query<TaskQueueItem>(`
            UPDATE public.task_queue
            SET status = 'running', started_at = NOW()
            WHERE id = (
                SELECT id FROM public.task_queue
                WHERE status = 'pending'
                ORDER BY created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *
        `);
        return res.rows[0] ?? null;
    }

    static async markDone(id: number): Promise<void> {
        await pool.query(
            `UPDATE public.task_queue SET status = 'done', finished_at = NOW() WHERE id = $1`,
            [id]
        );
    }

    static async markFailed(id: number, error: string): Promise<void> {
        await pool.query(
            `UPDATE public.task_queue SET status = 'failed', finished_at = NOW(), error = $2 WHERE id = $1`,
            [id, error]
        );
    }

    static async enqueue(task: string, params: Record<string, any> = {}): Promise<number> {
        const res = await pool.query<{ id: number }>(
            `INSERT INTO public.task_queue (task, params) VALUES ($1, $2) RETURNING id`,
            [task, JSON.stringify(params)]
        );
        return res.rows[0].id;
    }

    /** Clean up old completed/failed tasks older than 7 days */
    static async cleanup(): Promise<void> {
        await pool.query(`
            DELETE FROM public.task_queue
            WHERE status IN ('done', 'failed')
            AND finished_at < NOW() - INTERVAL '7 days'
        `);
    }
}
