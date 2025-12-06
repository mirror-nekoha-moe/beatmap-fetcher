import path from 'path';
import dotenv from 'dotenv';
import { init } from './pgDatabaseInit';
import { checkEnvVariables } from './envInit';
import { thControllerMain } from './threadController';
import fetch from 'node-fetch';
import chalk from 'chalk';

chalk.level = 3;

dotenv.config({ path: path.join(__dirname, `.env.${process.env.NODE_ENV}`) });
const WEBHOOK_URL = process.env.MIRROR_LOG_WEBHOOK;
const BATCH_SIZE = 10;
const BATCH_INTERVAL = 1000;

let logBuffer: string[] = [];
let batchTimer: NodeJS.Timeout | null = null;

function stripAnsi(str: string): string {
  // Regex to remove ANSI escape codes
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function sendBatch() {
  if (logBuffer.length === 0 || !WEBHOOK_URL) return;
  // Use ansi code block, keep ANSI escapes
  const content = '```ansi\n' + logBuffer.join('\n').slice(0, 1900) + '\n```';
  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  }).catch(() => {});
  logBuffer = [];
}

function discordLog(...args: any[]) {
  let msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');

  // For Discord: prefix for diff highlighting
  let discordMsg = msg;
  if (msg.startsWith('[ERROR]')) discordMsg = '- ' + msg;
  else if (msg.startsWith('[WARN]')) discordMsg = '+ ' + msg;

  logBuffer.push(discordMsg);

  if (logBuffer.length >= BATCH_SIZE) {
    sendBatch();
    if (batchTimer) clearTimeout(batchTimer);
  } else if (!batchTimer) {
    batchTimer = setTimeout(() => {
      sendBatch();
      batchTimer = null;
    }, BATCH_INTERVAL);
  }

  // For terminal: print with ANSI colors (no prefix modification)
  process.stdout.write(msg + '\n');
}

// Hook into console.log globally
console.log = discordLog;
console.error = (...args) => discordLog(chalk.red('[ERROR]'), ...args);
console.warn = (...args) => discordLog(chalk.yellow('[WARN]'), ...args);

async function main(): Promise<void> {
    console.log("[ beatmap-fetcher ]");
    await checkEnvVariables();
    await init();
    thControllerMain();
    console.log("main() execution done.");   
}

main().catch((err) => {
    console.error('Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
});
