/* 
    DOMAIN MODELS
    These represent database rows.
*/

/* ===========================
   Beatmap
   =========================== */
export interface Beatmap {
    accuracy: number | null;
    ar: number | null;
    beatmapset_id: bigint | null;
    bpm: number | null;
    checksum: string | null;
    convert: boolean | null;
    count_circles: bigint | null;
    count_sliders: bigint | null;
    count_spinners: bigint | null;
    cs: number | null;
    deleted_at: Date | null;
    difficulty_rating: number | null;
    drain: number | null;
    hit_length: bigint | null;
    id: bigint;
    is_scoreable: boolean | null;
    last_updated: Date | null;
    max_combo: bigint | null;
    mode: string | null;
    mode_int: number | null;
    passcount: bigint | null;
    playcount: bigint | null;
    status: string | null;
    total_length: bigint | null;
    url: string | null;
    user_id: bigint | null;
    version: string | null;
}