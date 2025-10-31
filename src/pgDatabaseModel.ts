import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, ".env") });

export const schema = {
    table_beatmap: `
        CREATE TABLE IF NOT EXISTS public.${process.env.TABLE_BEATMAP} (
            "id" BIGINT NOT NULL PRIMARY KEY,
            "beatmapset_id" BIGINT NULL DEFAULT NULL,
            "mode" SMALLINT NULL DEFAULT NULL,
            "status" SMALLINT NULL DEFAULT NULL,
            "version" VARCHAR(100) NULL DEFAULT NULL,
            "creator" VARCHAR(100) NULL DEFAULT NULL,
            "user_id" BIGINT NULL DEFAULT NULL,
            "difficulty_rating" REAL NULL DEFAULT NULL,
            "cs" REAL NULL DEFAULT NULL,
            "ar" REAL NULL DEFAULT NULL,
            "od" REAL NULL DEFAULT NULL,
            "hp" REAL NULL DEFAULT NULL,
            "count_circles" BIGINT NULL DEFAULT NULL,
            "count_sliders" BIGINT NULL DEFAULT NULL,
            "count_spinners" BIGINT NULL DEFAULT NULL,
            "max_combo" BIGINT NULL DEFAULT NULL,
            "bpm" REAL NULL DEFAULT NULL,
            "total_length" BIGINT NULL DEFAULT NULL,
            "hit_length" BIGINT NULL DEFAULT NULL,
            "checksum" VARCHAR(32) NULL DEFAULT NULL,
            "last_updated" TIMESTAMPTZ NULL DEFAULT NULL,
            "url" TEXT NULL DEFAULT NULL,
            "playcount" BIGINT NULL DEFAULT NULL,
            "passcount" BIGINT NULL DEFAULT NULL,
            "is_scoreable" BOOLEAN NULL DEFAULT TRUE
        );

        CREATE INDEX IF NOT EXISTS idx_beatmap_beatmapset_id ON public.${process.env.TABLE_BEATMAP} (beatmapset_id);
        CREATE INDEX IF NOT EXISTS idx_beatmap_mode ON public.${process.env.TABLE_BEATMAP} (mode);
        CREATE INDEX IF NOT EXISTS idx_beatmap_difficulty_rating ON public.${process.env.TABLE_BEATMAP} (difficulty_rating);
        CREATE INDEX IF NOT EXISTS idx_beatmap_checksum ON public.${process.env.TABLE_BEATMAP} (checksum);

        ALTER TABLE public.${process.env.TABLE_BEATMAP} OWNER TO ${process.env.PG_USERNAME};
    `,

    table_beatmapset: `
        CREATE TABLE IF NOT EXISTS public.${process.env.TABLE_BEATMAPSET} (
            "id" BIGINT NOT NULL PRIMARY KEY,
            "status" SMALLINT NULL DEFAULT NULL,
            "title" TEXT NULL DEFAULT NULL,
            "title_unicode" TEXT NULL DEFAULT NULL,
            "artist" TEXT NULL DEFAULT NULL,
            "artist_unicode" TEXT NULL DEFAULT NULL,
            "creator" VARCHAR(30) NULL DEFAULT NULL,
            "user_id" BIGINT NULL DEFAULT NULL,
            "source" TEXT NULL DEFAULT NULL,
            "tags" TEXT NULL DEFAULT NULL,
            "beatmap_count" SMALLINT NULL DEFAULT NULL,
            "osu" SMALLINT NULL DEFAULT NULL,
            "taiko" SMALLINT NULL DEFAULT NULL,
            "fruits" SMALLINT NULL DEFAULT NULL,
            "mania" SMALLINT NULL DEFAULT NULL,
            "bpm" REAL NULL DEFAULT NULL,
            "submitted" TIMESTAMPTZ NULL DEFAULT NULL,
            "updated" TIMESTAMPTZ NULL DEFAULT NULL,
            "ranked" TIMESTAMPTZ NULL DEFAULT NULL,
            "loved" TIMESTAMPTZ NULL DEFAULT NULL,
            "approved" TIMESTAMPTZ NULL DEFAULT NULL,
            "last_lookup" TIMESTAMPTZ NULL DEFAULT NULL,
            "genre_id" SMALLINT NULL DEFAULT NULL,
            "language_id" SMALLINT NULL DEFAULT NULL,
            "missing_audio" BOOLEAN NULL DEFAULT NULL,
            "deleted" BOOLEAN NULL DEFAULT NULL,
            "downloaded" BOOLEAN NULL DEFAULT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_beatmapset_status ON public.${process.env.TABLE_BEATMAPSET} (status);
        CREATE INDEX IF NOT EXISTS idx_beatmapset_artist ON public.${process.env.TABLE_BEATMAPSET} (artist);
        CREATE INDEX IF NOT EXISTS idx_beatmapset_title ON public.${process.env.TABLE_BEATMAPSET} (title);
        CREATE INDEX IF NOT EXISTS idx_beatmapset_creator ON public.${process.env.TABLE_BEATMAPSET} (creator);
        CREATE INDEX IF NOT EXISTS idx_beatmapset_bpm ON public.${process.env.TABLE_BEATMAPSET} (bpm);

        ALTER TABLE public.${process.env.TABLE_BEATMAPSET} OWNER TO ${process.env.PG_USERNAME};
    `,

    table_stats: `
        CREATE TABLE IF NOT EXISTS public.${process.env.TABLE_STATS} (
            last_beatmapset_id bigint NULL DEFAULT 0,
            beatmapset_count bigint NULL DEFAULT 0,
            beatmap_count bigint NULL DEFAULT 0,
            ranked_count bigint NULL DEFAULT 0,
            approved_count bigint NULL DEFAULT 0,
            loved_count bigint NULL DEFAULT 0,
            graveyard_count bigint NULL DEFAULT 0,
            pending_count bigint NULL DEFAULT 0
        );
        ALTER TABLE public.${process.env.TABLE_STATS} OWNER TO ${process.env.PG_USERNAME};
    `,
};