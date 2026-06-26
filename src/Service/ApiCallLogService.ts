import { createPool } from "@Core/Database/Connection";
import { Environment } from "@Bootstrap/Environment";

const pool = createPool();

export class ApiCallLogService {
    private static v1Bucket = 0;
    private static v2Bucket = 0;
    private static currentMinute = ApiCallLogService.getMinuteBucket();
    private static readonly RETENTION_HOURS = 6;
    private static readonly FLUSH_INTERVAL_MS = 30 * 1000; // flush every 30s

    private static getMinuteBucket(): Date {
        const date = new Date();
        date.setSeconds(0, 0);
        return date;
    }

    public static logV1(): void {
        this.v1Bucket++;
    }

    public static logV2(): void {
        this.v2Bucket++;
    }

    private static async flush(): Promise<void> {
        const minute = this.currentMinute;
        const v1 = this.v1Bucket;
        const v2 = this.v2Bucket;

        // Rotate to new bucket
        this.currentMinute = this.getMinuteBucket();
        this.v1Bucket = 0;
        this.v2Bucket = 0;

        if (v1 === 0 && v2 === 0) return;

        const cutoff = new Date(Date.now() - this.RETENTION_HOURS * 60 * 60 * 1000);
        const client = await pool.connect();
        try {
            if (v1 > 0) {
                await client.query(
                    `INSERT INTO public.${Environment.env.TABLE_API_CALLS_V1} (minute, calls)
                     VALUES ($1, $2)
                     ON CONFLICT (minute) DO UPDATE
                     SET calls = ${Environment.env.TABLE_API_CALLS_V1}.calls + EXCLUDED.calls`,
                    [minute, v1]
                );
            }
            if (v2 > 0) {
                await client.query(
                    `INSERT INTO public.${Environment.env.TABLE_API_CALLS_V2} (minute, calls)
                     VALUES ($1, $2)
                     ON CONFLICT (minute) DO UPDATE
                     SET calls = ${Environment.env.TABLE_API_CALLS_V2}.calls + EXCLUDED.calls`,
                    [minute, v2]
                );
            }
            // Prune rows older than 6h
            await client.query(`DELETE FROM public.${Environment.env.TABLE_API_CALLS_V1} WHERE minute < $1`, [cutoff]);
            await client.query(`DELETE FROM public.${Environment.env.TABLE_API_CALLS_V2} WHERE minute < $1`, [cutoff]);
        } catch (err) {
            console.error("ApiCallLogService flush error:", err instanceof Error ? err.message : err);
        } finally {
            client.release();
        }
    }

    public static start(): void {
        setInterval(() => {
            this.flush().catch(() => {});
        }, this.FLUSH_INTERVAL_MS);
    }
}
