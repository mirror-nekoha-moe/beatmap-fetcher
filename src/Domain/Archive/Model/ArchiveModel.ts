/*
    DOMAIN MODELS
    These represent database rows.
*/

/* ===========================
   Archive
   =========================== */
export interface Archive {
    archive_date: string;
    mode: string;
    file_name: string;
    size_gb: number;
    beatmapset_count: number;
    created_at: Date;
}