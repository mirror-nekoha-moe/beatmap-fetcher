import fetch from 'node-fetch';
import chalk from 'chalk';
import { Environment } from '@Bootstrap/Environment';

chalk.level = 3;

export class Logger {
    private static logBuffer: string[] = [];
    private static batchTimer: NodeJS.Timeout | null = null;
    private static WEBHOOK_URL = Environment.env.MIRROR_LOG_WEBHOOK;
    private static readonly BATCH_SIZE = 10;
    private static readonly BATCH_INTERVAL = 1000;

    static hookConsole(): void {
        console.log = Logger.discordLog;
        console.error = (...args) => Logger.discordLog(chalk.red('[ERROR]'), ...args);
        console.warn = (...args) => Logger.discordLog(chalk.yellow('[WARN]'), ...args);
    }

    private static stripAnsi(str: string): string {
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    }

    private static sendBatch(): void {
        if (Logger.logBuffer.length === 0 || !Logger.WEBHOOK_URL) return;
        const content = '```ansi\n' + Logger.logBuffer.join('\n').slice(0, 1900) + '\n```';
        fetch(Logger.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        }).catch(() => {});
        Logger.logBuffer = [];
    }

    private static discordLog(...args: any[]): void {
        const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');

        // Discord formatting
        let discordMsg = msg;
        if (msg.startsWith('[ERROR]')) discordMsg = '- ' + msg;
        else if (msg.startsWith('[WARN]')) discordMsg = '+ ' + msg;

        Logger.logBuffer.push(discordMsg);

        if (Logger.logBuffer.length >= Logger.BATCH_SIZE) {
            Logger.sendBatch();
            if (Logger.batchTimer) clearTimeout(Logger.batchTimer);
        } else if (!Logger.batchTimer) {
            Logger.batchTimer = setTimeout(() => {
                Logger.sendBatch();
                Logger.batchTimer = null;
            }, Logger.BATCH_INTERVAL);
        }

        process.stdout.write(msg + '\n');
    }
}