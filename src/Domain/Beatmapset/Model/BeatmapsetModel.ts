/* 
    DOMAIN MODELS
    These represent database rows.
*/

/* ===========================
   Beatmapset
   =========================== */
export interface Beatmapset {
    anime_cover: boolean | null;
    artist: string | null;
    artist_unicode: string | null;
    beatmap_count: number | null;
    bpm: number | null;
    card: string | null;
    card_2x: string | null;
    cover: string | null;
    cover_2x: string | null;
    creator: string | null;
    deleted_at: Date | null;
    description: string | null;
    download_disabled: boolean | null;
    downloaded: boolean | null;
    favourite_count: bigint | null;
    file_size: bigint | null;
    genre_id: number | null;
    id: bigint;
    is_scoreable: boolean | null;
    language_id: number | null;
    last_updated: Date | null;
    list: string | null;
    list_2x: string | null;
    mode_fruits_count: number | null;
    mode_mania_count: number | null;
    mode_osu_count: number | null;
    mode_taiko_count: number | null;
    more_information: string | null;
    nsfw: boolean | null;
    offset: number | null;
    playcount: bigint | null;
    preview_url: string | null;
    ranked_date: Date | null;
    rating: number | null;
    slimcover: string | null;
    slimcover_2x: string | null;
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
}