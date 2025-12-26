/* 
    DOMAIN MODELS
    These represent database rows.
*/

/* ===========================
   Beatmap
   =========================== */
export interface Beatmap {
    id: bigint;
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

/* ===========================
   BeatmapSet
   =========================== */
export interface BeatmapSet {
    id: bigint;
    anime_cover: boolean | null;
    artist: string | null;
    artist_unicode: string | null;

    more_information: string | null;
    download_disabled: boolean | null;

    bpm: number | null;

    cover: string | null;
    cover_2x: string | null;
    card: string | null;
    card_2x: string | null;
    list: string | null;
    list_2x: string | null;
    slimcover: string | null;
    slimcover_2x: string | null;

    creator: string | null;
    deleted_at: Date | null;
    description: string | null;
    favourite_count: bigint | null;
    genre_id: number | null;

    is_scoreable: boolean | null;
    language_id: number | null;
    last_updated: Date | null;
    nsfw: boolean | null;
    offset: number | null;
    playcount: bigint | null;
    preview_url: string | null;

    ranked_date: Date | null;
    rating: number | null;

    source: string | null;
    spotlight: boolean | null;
    status: string | null;
    storyboard: boolean | null;

    submitted_date: Date | null;

    tags: string | null;

    title: string | null;
    title_unicode: string | null;
    user_id: bigint | null;
    video: boolean | null;

    beatmap_count: number | null;
    mode_osu_count: number | null;
    mode_taiko_count: number | null;
    mode_fruits_count: number | null;
    mode_mania_count: number | null;

    downloaded: boolean | null;
    file_size: bigint | null;
}

/* ===========================
   Stats (singleton table)
   =========================== */
export interface Stats {
    last_beatmapset_id: bigint;
    beatmapset_count: bigint;
    beatmap_count: bigint;
    ranked_count: bigint;
    approved_count: bigint;
    loved_count: bigint;
    graveyard_count: bigint;
    pending_count: bigint;
    total_size: bigint;
    scan_cursor: bigint;

    bm_ranked_count: bigint;
    bm_approved_count: bigint;
    bm_loved_count: bigint;
    bm_graveyard_count: bigint;
    bm_pending_count: bigint;

    missing_beatmapsets: bigint;

    osu_bm_ranked_count: bigint;
    osu_bm_approved_count: bigint;
    osu_bm_loved_count: bigint;
    osu_bm_graveyard_count: bigint;
    osu_bm_pending_count: bigint;

    taiko_bm_ranked_count: bigint;
    taiko_bm_approved_count: bigint;
    taiko_bm_loved_count: bigint;
    taiko_bm_graveyard_count: bigint;
    taiko_bm_pending_count: bigint;

    fruits_bm_ranked_count: bigint;
    fruits_bm_approved_count: bigint;
    fruits_bm_loved_count: bigint;
    fruits_bm_graveyard_count: bigint;
    fruits_bm_pending_count: bigint;

    mania_bm_ranked_count: bigint;
    mania_bm_approved_count: bigint;
    mania_bm_loved_count: bigint;
    mania_bm_graveyard_count: bigint;
    mania_bm_pending_count: bigint;
}
