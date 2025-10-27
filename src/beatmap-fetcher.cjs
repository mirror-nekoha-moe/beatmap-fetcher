const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const { getDownloadUrl, downloadBeatmapSet } = require('./beatmap-downloader.cjs');

const pool = new Pool({
  host: process.env.PG_HOSTNAME,
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  max: 20,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 0
});

// VAR
let last_known_beatmapset_id = 0;

(async () => {
  console.log('Testing PostgreSQL connection...');
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL!');
    client.release();
  } catch (err) {
    console.error('Failed to connect to PostgreSQL:', err);
    process.exit(1);
  }
})();