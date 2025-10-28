const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });

const schema = {
    table_beatmap: `
        CREATE TABLE IF NOT EXISTS public.${process.env.TABLE_BEATMAP} (
            id bigint NOT NULL,
            creator character varying(100) NOT NULL,
            mode smallint NOT NULL,
            beatmapset_id bigint NOT NULL,
            status smallint,
            cs real,
            ar real,
            od real,
            hp real,
            count_circles bigint,
            count_sliders bigint,
            count_spinners bigint,
            bpm real,
            total_length bigint,
            version character varying(100) NOT NULL
        );

        ALTER TABLE public.${process.env.TABLE_BEATMAP} OWNER TO ${process.env.PG_USERNAME};
    `,

    table_beatmapset: `
        CREATE TABLE IF NOT EXISTS public.${process.env.TABLE_BEATMAPSET} (
            id bigint NOT NULL,
            status smallint NOT NULL,
            title text NOT NULL,
            artist text NOT NULL,
            creator character varying(30) NOT NULL,
            beatmap_count smallint NOT NULL,
            submitted timestamp with time zone NOT NULL,
            updated timestamp with time zone NOT NULL,
            ranked timestamp with time zone NOT NULL,
            loved timestamp with time zone NOT NULL,
            approved timestamp with time zone NOT NULL,
            osu smallint NOT NULL,
            taiko smallint NOT NULL,
            fruits smallint NOT NULL,
            mania smallint NOT NULL,
            missing_audio boolean NOT NULL,
            deleted boolean NOT NULL,
            source text,
            tags text,
            last_lookup timestamp with time zone NOT NULL,
            genre_id smallint,
            language_id smallint,
            title_unicode text NOT NULL,
            artist_unicode text NOT NULL
        );

        ALTER TABLE public.${process.env.TABLE_BEATMAPSET} OWNER TO ${process.env.PG_USERNAME};
    `,

    table_stats: `
        CREATE TABLE IF NOT EXISTS public.${process.env.TABLE_STATS} (
            last_beatmapset_id bigint DEFAULT 0 NOT NULL,
            beatmapset_count bigint DEFAULT 0 NOT NULL,
            beatmap_count bigint DEFAULT 0 NOT NULL,
            ranked_count bigint DEFAULT 0 NOT NULL,
            approved_count bigint DEFAULT 0 NOT NULL,
            loved_count bigint DEFAULT 0 NOT NULL,
            graveyard_count bigint DEFAULT 0 NOT NULL,
            pending_count bigint DEFAULT 0 NOT NULL
        );
        ALTER TABLE public.${process.env.TABLE_STATS} OWNER TO ${process.env.PG_USERNAME};
    `,
};

module.exports = { schema };