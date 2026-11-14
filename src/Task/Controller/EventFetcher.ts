import chalk from 'chalk';

import { BeatmapsetController } from '@Domain/Beatmapset/Controller/BeatmapsetController';
import { StatsRepository } from '@Domain/Stats/Repository/StatsRepository';
import { Environment } from '@Bootstrap/Environment';
import { OsuApiService } from '@Service/OsuApiService';
import { BaseTask } from '@Task/BaseTask';

const BEATMAPSET_TYPES = new Set(['beatmapsetUpload', 'beatmapsetUpdate', 'beatmapsetRevive', 'beatmapsetDelete']);
const PAGE_SIZE = 50;
const MAX_FETCH_ATTEMPTS = 5;
const UPLOAD_EMBED_COLOR = 0xffcc22;

export class EventFetcher {
    private static failedAttempts = new Map<number, number>();

    // cursor is base64 {"event_id": N}, build it ourselves to resume
    private static makeCursor(eventId: number): string {
        const json = JSON.stringify({ event_id: eventId });
        return Buffer.from(json).toString('base64url');
    }

    private static parseBeatmapsetId(url: string): number | null {
        // osu sends both /s/ and /beatmapsets/ urls
        const match = url.match(/\/(?:s|beatmapsets)\/(\d+)/);
        if (!match) {
            return null;
        }
        return Number(match[1]);
    }

    private static async fetchLatestEventId(): Promise<number> {
        const api = await OsuApiService.v2.getApiInstance();
        const result = await api.getEvents({ sort: 'id_desc' });
        return result.events[0]?.id ?? 0;
    }

    private static async fetchBeatmapset(beatmapsetId: number): Promise<any> {
        try {
            const beatmapset = await BeatmapsetController.fetchBeatmapsetFromOsu(beatmapsetId, false, false, true);
            this.failedAttempts.delete(beatmapsetId);
            return beatmapset;
        } catch (err) {
            const previousAttempts = this.failedAttempts.get(beatmapsetId) ?? 0;
            const attempts = previousAttempts + 1;

            // one broken set shouldn't block the feed forever
            if (attempts >= MAX_FETCH_ATTEMPTS) {
                console.error(chalk.red(`EventFetcher: giving up on beatmapset ${beatmapsetId} after ${attempts} attempts`));
                this.failedAttempts.delete(beatmapsetId);
                return null;
            }

            this.failedAttempts.set(beatmapsetId, attempts);
            throw err;
        }
    }

    // beatmapset is null if TRACK_ALL_MAPS is off, use event data then
    private static async sendUploadEmbed(event: any, beatmapsetId: number, beatmapset: any): Promise<void> {
        const webhookUrl = Environment.env.MIRROR_LOG_UPLOAD;
        if (!webhookUrl) return;

        let title = event.beatmapset.title;
        let mapper = event.user?.username ?? '/';
        let mapperUrl = `https://osu.ppy.sh${event.user?.url ?? ''}`;
        let status = '/';
        let cover = null;

        if (beatmapset) {
            const artist = beatmapset.artist_unicode || beatmapset.artist;
            const songTitle = beatmapset.title_unicode || beatmapset.title;
            title = `${artist} - ${songTitle}`;
            mapper = beatmapset.creator ?? mapper;
            mapperUrl = `https://osu.ppy.sh/users/${beatmapset.user_id}`;
            status = beatmapset.status;
            cover = beatmapset.covers?.['cover@2x'] ?? beatmapset.covers?.cover ?? null;
        }

        const embed: Record<string, any> = {
            title: `New Upload: ${title}`,
            url: `https://osu.ppy.sh/beatmapsets/${beatmapsetId}`,
            color: UPLOAD_EMBED_COLOR,
            fields: [
                {
                    name: 'Mapper',
                    value: `[${mapper}](${mapperUrl})`,
                    inline: true
                },
                {
                    name: 'Status',
                    value: status,
                    inline: true
                },
            ],
            footer: {
                text: `ID: ${beatmapsetId}`
            },
            timestamp: event.created_at,
        };

        if (cover) {
            embed.image = {
                url: cover
            };
        }

        await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                embeds: [embed]
            }),
        });
    }

    private static async processEvents(maxPages: number): Promise<void> {
        const api = await OsuApiService.v2.getApiInstance();
        let lastEventId = await StatsRepository.getGlobalEventCursor();

        // first run, start at the newest event
        if (lastEventId === 0) {
            lastEventId = await this.fetchLatestEventId();
            await StatsRepository.updateGlobalEventCursor(lastEventId);
            console.log(chalk.cyan(`EventFetcher: initialized event cursor at ${lastEventId}`));
            return;
        }

        const beatmapsetIds = new Set<number>();
        const uploadEvents = new Map<number, any>();
        let firstUploadId = 0;
        let eventCount = 0;
        let page = 0;
        let caughtUp = false;

        while (page < maxPages) {
            const result = await api.getEvents({
                sort: 'id_asc',
                cursor_string: this.makeCursor(lastEventId)
            });
            page++;

            for (const event of result.events) {
                if (event.id > lastEventId) {
                    lastEventId = event.id;
                }
                if (!BEATMAPSET_TYPES.has(event.type)) {
                    continue;
                }

                const url = (event as any).beatmapset?.url as string | undefined;
                if (!url) {
                    continue;
                }
                const beatmapsetId = this.parseBeatmapsetId(url);
                if (!beatmapsetId) {
                    continue;
                }
                beatmapsetIds.add(beatmapsetId);

                if (event.type === 'beatmapsetUpload') {
                    uploadEvents.set(beatmapsetId, event);
                    if (firstUploadId === 0) {
                        firstUploadId = beatmapsetId;
                    }
                }
            }
            eventCount += result.events.length;

            if (result.events.length < PAGE_SIZE) {
                caughtUp = true;
                break;
            }
        }

        const fetchedBeatmapsets = new Map<number, any>();
        for (const beatmapsetId of beatmapsetIds) {
            const beatmapset = await this.fetchBeatmapset(beatmapsetId);
            fetchedBeatmapsets.set(beatmapsetId, beatmapset);
        }

        // fetch errors throw before this, cursor stays and next run retries
        await StatsRepository.updateGlobalEventCursor(lastEventId);

        // send after the cursor is saved, a retried run would post twice otherwise
        for (const [beatmapsetId, event] of uploadEvents) {
            const beatmapset = fetchedBeatmapsets.get(beatmapsetId);
            try {
                await this.sendUploadEmbed(event, beatmapsetId, beatmapset);
                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                console.warn(chalk.yellow(`EventFetcher: failed to send upload embed for ${beatmapsetId}:`), err instanceof Error ? err.message : err);
            }
        }

        // below this id BeatmapsetFetcher backfills
        if (firstUploadId > 0) {
            const backfillTarget = await StatsRepository.getBackfillTarget();
            if (backfillTarget === 0) {
                await StatsRepository.updateBackfillTarget(firstUploadId);
                console.log(chalk.cyan(`EventFetcher: backfill target set to ${firstUploadId}`));
            }
        }

        if (beatmapsetIds.size > 0) {
            console.log(chalk.green(`EventFetcher: ${beatmapsetIds.size} beatmapset(s) from ${eventCount} events (cursor: ${lastEventId})`));
        } else {
            console.log(chalk.gray(`EventFetcher: no beatmapset events in ${eventCount} events (cursor: ${lastEventId})`));
        }
        if (!caughtUp) {
            console.log(chalk.yellow(`EventFetcher: page limit reached (${maxPages}), catching up next run`));
        }
    }

    static async run(interval: number, errorDelay: number, maxPages: number): Promise<void> {
        await BaseTask.runTask(interval*60*1000, errorDelay*60*1000, this.name, async () => {
            await this.processEvents(maxPages);
        });
    }
}