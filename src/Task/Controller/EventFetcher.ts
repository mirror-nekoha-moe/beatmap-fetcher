import chalk from 'chalk';

import { BeatmapsetController } from '@Domain/Beatmapset/Controller/BeatmapsetController';
import { BeatmapsetRepository } from '@Domain/Beatmapset/Repository/BeatmapsetRepository';
import { StatsRepository } from '@Domain/Stats/Repository/StatsRepository';
import { OsuApiService } from '@Service/OsuApiService';
import { EventPublishService } from '@Service/EventPublishService';
import { WebhookService } from '@Service/WebhookService';
import { BaseTask } from '@Task/BaseTask';

const BEATMAPSET_TYPES = new Set(['beatmapsetApprove', 'beatmapsetUpload', 'beatmapsetUpdate', 'beatmapsetRevive', 'beatmapsetDelete']);
const PAGE_SIZE = 50;
const MAX_FETCH_ATTEMPTS = 5;

export class EventFetcher {
    private static failedAttempts = new Map<number, number>();

    private static async handleEvent(event: any, beatmapsetId: number): Promise<void> {
        await EventPublishService.publish('events', event, beatmapsetId);
    }

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

    private static async fetchBeatmapset(beatmapsetId: number, download: boolean): Promise<any> {
        try {
            // skip GraveyardDownloader
            const beatmapset = await BeatmapsetController.fetchBeatmapsetFromOsu(beatmapsetId, download, false, true, download);
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
        const beatmapsetEvents: { event: any; beatmapsetId: number }[] = [];
        const uploadEvents = new Map<number, any>();
        const updatedIds = new Set<number>();
        const revivedIds = new Set<number>();
        const deleteEvents = new Map<number, any>();
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
                beatmapsetEvents.push({ event, beatmapsetId });

                if (event.type === 'beatmapsetUpload') {
                    uploadEvents.set(beatmapsetId, event);
                    if (firstUploadId === 0) {
                        firstUploadId = beatmapsetId;
                    }
                }
                // only on new map files, not metadata edits
                if (event.type === 'beatmapsetUpdate') {
                    updatedIds.add(beatmapsetId);
                }
                if (event.type === 'beatmapsetDelete') {
                    deleteEvents.set(beatmapsetId, event);
                }
                if (event.type === 'beatmapsetRevive') {
                    revivedIds.add(beatmapsetId);
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
            const isUpload = uploadEvents.has(beatmapsetId);
            const isUpdate = updatedIds.has(beatmapsetId);
            const isRevive = revivedIds.has(beatmapsetId);
            const beatmapset = await this.fetchBeatmapset(beatmapsetId, isUpload || isUpdate || isRevive);
            fetchedBeatmapsets.set(beatmapsetId, beatmapset);
        }

        // deleted sets
        for (const [beatmapsetId, event] of deleteEvents) {
            if (!fetchedBeatmapsets.get(beatmapsetId)) {
                await BeatmapsetRepository.markDeleted(beatmapsetId, new Date(event.created_at));
            }
        }

        // fetch errors throw before this, cursor stays and next run retries
        await StatsRepository.updateGlobalEventCursor(lastEventId);

        // send after the cursor is saved, a retried run would post twice otherwise
        for (const [beatmapsetId, event] of uploadEvents) {
            const beatmapset = fetchedBeatmapsets.get(beatmapsetId);
            try {
                await WebhookService.sendUploadEmbed(event, beatmapsetId, beatmapset);
                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                console.warn(chalk.yellow(`EventFetcher: failed to send upload embed for ${beatmapsetId}:`), err instanceof Error ? err.message : err);
            }
        }

        // after the fetches, the server reads the fresh set from the db
        for (const { event, beatmapsetId } of beatmapsetEvents) {
            try {
                await this.handleEvent(event, beatmapsetId);
            } catch (err) {
                console.warn(chalk.yellow(`EventFetcher: failed to handle event ${event.id}:`), err instanceof Error ? err.message : err);
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