/* 
    DOMAIN MODELS
    These represent database rows.
*/

/* ===========================
   Beatmapset
   =========================== */
export interface Beatmapset {
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