import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, `.env.${process.env.NODE_ENV}`) });

export const Tables = {
    BEATMAP: process.env.TABLE_BEATMAP!,
    BEATMAPSET: process.env.TABLE_BEATMAPSET!,
    STATS: process.env.TABLE_STATS!,
} as const;
