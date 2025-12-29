/* 
    DOMAIN MODELS
    These represent database rows.
*/

/* ===========================
   Stats (singleton table)
   ===========================*/
export interface Stats {
    last_beatmapset_id: bigint;
    beatmapset_count: bigint;
    beatmap_count: bigint;

    ranked_count: bigint;
    approved_count: bigint;
    loved_count: bigint;
    graveyard_count: bigint;
    pending_count: bigint;
    wip_count: bigint;
    qualified_count: bigint;

    total_size: bigint;
    scan_cursor: bigint;

    bm_ranked_count: bigint;
    bm_approved_count: bigint;
    bm_loved_count: bigint;
    bm_graveyard_count: bigint;
    bm_pending_count: bigint;
    bm_wip_count: bigint;
    bm_qualified_count: bigint;

    missing_beatmapsets: bigint;

    osu_bm_ranked_count: bigint;
    osu_bm_approved_count: bigint;
    osu_bm_loved_count: bigint;
    osu_bm_graveyard_count: bigint;
    osu_bm_pending_count: bigint;
    osu_bm_wip_count: bigint;
    osu_bm_qualified_count: bigint;

    taiko_bm_ranked_count: bigint;
    taiko_bm_approved_count: bigint;
    taiko_bm_loved_count: bigint;
    taiko_bm_graveyard_count: bigint;
    taiko_bm_pending_count: bigint;
    taiko_bm_wip_count: bigint;
    taiko_bm_qualified_count: bigint;

    fruits_bm_ranked_count: bigint;
    fruits_bm_approved_count: bigint;
    fruits_bm_loved_count: bigint;
    fruits_bm_graveyard_count: bigint;
    fruits_bm_pending_count: bigint;
    fruits_bm_wip_count: bigint;
    fruits_bm_qualified_count: bigint;

    mania_bm_ranked_count: bigint;
    mania_bm_approved_count: bigint;
    mania_bm_loved_count: bigint;
    mania_bm_graveyard_count: bigint;
    mania_bm_pending_count: bigint;
    mania_bm_wip_count: bigint;
    mania_bm_qualified_count: bigint;
}