import { Environment } from '@Bootstrap/Environment';

/*
    THIS FILE DEFINES THE DATABASE STRUCTURE
    MODIFY THIS FILE TO ADD TABLES OR COLUMNS
*/

interface PrimaryKey {
    table: string;
    column: string;
}

interface ForeignKey {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    onDelete: string;
    constraintName: string;
}

export class Schema {
    static primaryKeys: PrimaryKey[] = [
        { table: Environment.env.TABLE_BEATMAP!, column: 'id' },
        { table: Environment.env.TABLE_BEATMAPSET!, column: 'id' },
    ];

    static foreignKeys: ForeignKey[] = [
        {
            sourceTable: Environment.env.TABLE_BEATMAP!,
            sourceColumn: 'beatmapset_id',
            targetTable: Environment.env.TABLE_BEATMAPSET!,
            targetColumn: 'id',
            onDelete: 'CASCADE',
            constraintName: 'fk_beatmapset_id',
        },
    ];

    static Tables = {
        beatmap: `
            CREATE TABLE IF NOT EXISTS public.${Environment.env.TABLE_BEATMAP} (
                "accuracy" REAL NULL DEFAULT NULL,
                "ar" REAL NULL DEFAULT NULL,
                "beatmapset_id" BIGINT NULL DEFAULT NULL,
                "bpm" REAL NULL DEFAULT NULL,
                "checksum" TEXT NULL DEFAULT NULL,
                "convert" BOOLEAN NULL DEFAULT NULL,
                "count_circles" BIGINT NULL DEFAULT NULL,
                "count_sliders" BIGINT NULL DEFAULT NULL,
                "count_spinners" BIGINT NULL DEFAULT NULL,
                "cs" REAL NULL DEFAULT NULL,
                "deleted_at" TIMESTAMPTZ NULL DEFAULT NULL,
                "difficulty_rating" REAL NULL DEFAULT NULL,
                "drain" REAL NULL DEFAULT NULL,
                "hit_length" BIGINT NULL DEFAULT NULL,
                "id" BIGINT NOT NULL PRIMARY KEY,
                "is_scoreable" BOOLEAN NULL DEFAULT NULL,
                "last_updated" TIMESTAMPTZ NULL DEFAULT NULL,
                "max_combo" BIGINT NULL DEFAULT NULL,
                "mode" TEXT NULL DEFAULT NULL,
                "mode_int" SMALLINT NULL DEFAULT NULL,
                "passcount" BIGINT NULL DEFAULT NULL,
                "playcount" BIGINT NULL DEFAULT NULL,
                "status" TEXT NULL DEFAULT NULL,
                "total_length" BIGINT NULL DEFAULT NULL,
                "url" TEXT NULL DEFAULT NULL,
                "user_id" BIGINT NULL DEFAULT NULL,
                "version" TEXT NULL DEFAULT NULL
            );
            ALTER TABLE public.${Environment.env.TABLE_BEATMAP} OWNER TO ${Environment.env.PG_USERNAME};
        `,

        beatmapset: `
            CREATE TABLE IF NOT EXISTS public.${Environment.env.TABLE_BEATMAPSET} (
                "anime_cover" BOOLEAN NULL DEFAULT NULL,
                "artist" TEXT NULL DEFAULT NULL,
                "artist_unicode" TEXT NULL DEFAULT NULL,
                "beatmap_count" SMALLINT NULL DEFAULT NULL,
                "bpm" REAL NULL DEFAULT NULL,
                "card" TEXT NULL DEFAULT NULL,
                "card_2x" TEXT NULL DEFAULT NULL,
                "cover" TEXT NULL DEFAULT NULL,
                "cover_2x" TEXT NULL DEFAULT NULL,
                "creator" VARCHAR(30) NULL DEFAULT NULL,
                "deleted_at" TIMESTAMPTZ NULL DEFAULT NULL,
                "description" TEXT NULL DEFAULT NULL,
                "download_disabled" BOOLEAN NULL DEFAULT NULL,
                "downloaded" BOOLEAN NULL DEFAULT NULL,
                "favourite_count" BIGINT NULL DEFAULT NULL,
                "file_size" BIGINT NULL DEFAULT NULL,
                "genre_id" SMALLINT NULL DEFAULT NULL,
                "id" BIGINT NOT NULL PRIMARY KEY,
                "is_scoreable" BOOLEAN NULL DEFAULT NULL,
                "language_id" SMALLINT NULL DEFAULT NULL,
                "last_updated" TIMESTAMPTZ NULL DEFAULT NULL,
                "list" TEXT NULL DEFAULT NULL,
                "list_2x" TEXT NULL DEFAULT NULL,
                "mode_fruits_count" SMALLINT NULL DEFAULT NULL,
                "mode_mania_count" SMALLINT NULL DEFAULT NULL,
                "mode_osu_count" SMALLINT NULL DEFAULT NULL,
                "mode_taiko_count" SMALLINT NULL DEFAULT NULL,
                "more_information" TEXT NULL DEFAULT NULL,
                "nsfw" BOOLEAN NULL DEFAULT NULL,
                "offset" INTEGER NULL DEFAULT NULL,
                "playcount" BIGINT NULL DEFAULT NULL,
                "preview_url" TEXT NULL DEFAULT NULL,
                "ranked_date" TIMESTAMPTZ NULL DEFAULT NULL,
                "rating" REAL NULL DEFAULT NULL,
                "slimcover" TEXT NULL DEFAULT NULL,
                "slimcover_2x" TEXT NULL DEFAULT NULL,
                "source" TEXT NULL DEFAULT NULL,
                "spotlight" BOOLEAN NULL DEFAULT NULL,
                "status" TEXT NULL DEFAULT NULL,
                "storyboard" BOOLEAN NULL DEFAULT NULL,
                "submitted_date" TIMESTAMPTZ NULL DEFAULT NULL,
                "tags" TEXT NULL DEFAULT NULL,
                "title" TEXT NULL DEFAULT NULL,
                "title_unicode" TEXT NULL DEFAULT NULL,
                "user_id" BIGINT NULL DEFAULT NULL,
                "video" BOOLEAN NULL DEFAULT NULL
            );
            ALTER TABLE public.${Environment.env.TABLE_BEATMAPSET} OWNER TO ${Environment.env.PG_USERNAME};
        `,

        stats: `
            CREATE TABLE IF NOT EXISTS public.${Environment.env.TABLE_STATS} (
                last_beatmapset_id bigint NULL DEFAULT 0,
                beatmapset_count bigint NULL DEFAULT 0,
                beatmap_count bigint NULL DEFAULT 0,
                ranked_count bigint NULL DEFAULT 0,
                approved_count bigint NULL DEFAULT 0,
                loved_count bigint NULL DEFAULT 0,
                graveyard_count bigint NULL DEFAULT 0,
                wip_count bigint NULL DEFAULT 0,
                qualified_count bigint NULL DEFAULT 0,
                pending_count bigint NULL DEFAULT 0,
                total_size bigint NULL DEFAULT 0,
                scan_cursor bigint NULL DEFAULT 0,
                bm_ranked_count bigint NULL DEFAULT 0,
                bm_approved_count bigint NULL DEFAULT 0,
                bm_loved_count bigint NULL DEFAULT 0,
                bm_graveyard_count bigint NULL DEFAULT 0,
                bm_wip_count bigint NULL DEFAULT 0,
                bm_qualified_count bigint NULL DEFAULT 0,
                bm_pending_count bigint NULL DEFAULT 0,

                missing_beatmapsets bigint NULL DEFAULT 0,
                missing_beatmapsets_ranked bigint NULL DEFAULT 0,
                missing_beatmapsets_approved bigint NULL DEFAULT 0,
                missing_beatmapsets_loved bigint NULL DEFAULT 0,
                missing_beatmapsets_graveyard bigint NULL DEFAULT 0,
                missing_beatmapsets_pending bigint NULL DEFAULT 0,
                missing_beatmapsets_wip bigint NULL DEFAULT 0,
                missing_beatmapsets_qualified bigint NULL DEFAULT 0,

                osu_bm_ranked_count bigint NULL DEFAULT 0,
                osu_bm_approved_count bigint NULL DEFAULT 0,
                osu_bm_loved_count bigint NULL DEFAULT 0,
                osu_bm_graveyard_count bigint NULL DEFAULT 0,
                osu_bm_wip_count bigint NULL DEFAULT 0,
                osu_bm_qualified_count bigint NULL DEFAULT 0,
                osu_bm_pending_count bigint NULL DEFAULT 0,
                taiko_bm_ranked_count bigint NULL DEFAULT 0,
                taiko_bm_approved_count bigint NULL DEFAULT 0,
                taiko_bm_loved_count bigint NULL DEFAULT 0,
                taiko_bm_graveyard_count bigint NULL DEFAULT 0,
                taiko_bm_wip_count bigint NULL DEFAULT 0,
                taiko_bm_qualified_count bigint NULL DEFAULT 0,
                taiko_bm_pending_count bigint NULL DEFAULT 0,
                fruits_bm_ranked_count bigint NULL DEFAULT 0,
                fruits_bm_approved_count bigint NULL DEFAULT 0,
                fruits_bm_loved_count bigint NULL DEFAULT 0,
                fruits_bm_graveyard_count bigint NULL DEFAULT 0,
                fruits_bm_wip_count bigint NULL DEFAULT 0,
                fruits_bm_qualified_count bigint NULL DEFAULT 0,
                fruits_bm_pending_count bigint NULL DEFAULT 0,
                mania_bm_ranked_count bigint NULL DEFAULT 0,
                mania_bm_approved_count bigint NULL DEFAULT 0,
                mania_bm_loved_count bigint NULL DEFAULT 0,
                mania_bm_graveyard_count bigint NULL DEFAULT 0,
                mania_bm_wip_count bigint NULL DEFAULT 0,
                mania_bm_qualified_count bigint NULL DEFAULT 0,
                mania_bm_pending_count bigint NULL DEFAULT 0
            );
            ALTER TABLE public.${Environment.env.TABLE_STATS} OWNER TO ${Environment.env.PG_USERNAME};
        `,
    };
}