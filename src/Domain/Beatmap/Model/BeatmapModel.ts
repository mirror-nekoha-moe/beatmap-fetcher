/* 
    DOMAIN MODELS
    These represent database rows.
*/

/* ===========================
   Beatmap
   =========================== */
export interface Beatmap {
    beatmapset_id: bigint | null;
    difficulty_rating: number | null;
    id: bigint;
    lazer_only: boolean | null;
    mode: string | null;
    status: string | null;
    total_length: bigint | null;
    user_id: bigint | null;
    version: string | null;
    accuracy: number | null;
    ar: number | null;
    bpm: number | null;
    convert: boolean | null;
    count_circles: bigint | null;
    count_sliders: bigint | null;
    count_spinners: bigint | null;
    cs: number | null;
    deleted_at: Date | null;
    drain: number | null;
    hit_length: bigint | null;
    is_scoreable: boolean | null;
    last_updated: Date | null;
    mode_int: number | null;
    passcount: bigint | null;
    playcount: bigint | null;
    url: string | null;
    checksum: string | null;
    max_combo: bigint | null;
}