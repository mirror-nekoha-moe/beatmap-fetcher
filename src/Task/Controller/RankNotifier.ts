import chalk from 'chalk';
import * as osu from 'osu-api-v2-js';
import { BaseTask } from '@Task/BaseTask';
import { OsuApiService } from '@Service/OsuApiService';
import { WebhookService } from '@Service/WebhookService';
import { StatsRepository } from '@Domain/Stats/Repository/StatsRepository';
import { BeatmapsetController } from '@Domain/Beatmapset/Controller/BeatmapsetController';

const TRACKED_TYPES = new Set(['rank', 'love', 'qualify', 'disqualify', 'remove_from_loved']);
const DOWNLOAD_TYPES = new Set(['rank', 'love']);

// rank and love get refreshed by the download
const METADATA_TYPES = new Set([
    'nominate',
    'nomination_reset',
    'qualify',
    'disqualify',
    'remove_from_loved',
    'genre_edit',
    'language_edit',
    'nsfw_toggle',
    'offset_edit',
    'tags_edit',
    'beatmap_owner_change',
]);

const EVENT_TYPES: osu.Beatmapset.Event.Any['type'][] = [
    'rank',
    'love',
    'qualify',
    'disqualify',
    'remove_from_loved',
    'nominate',
    'nomination_reset',
    'genre_edit',
    'language_edit',
    'nsfw_toggle',
    'offset_edit',
    'tags_edit',
    'beatmap_owner_change',
    'nomination_reset_received',
    'kudosu_gain',
    'kudosu_lost',
    'kudosu_allow',
    'kudosu_deny',
    'kudosu_recalculate',
    'issue_resolve',
    'issue_reopen',
    'discussion_lock',
    'discussion_unlock',
    'discussion_delete',
    'discussion_restore',
    'discussion_post_delete',
    'discussion_post_restore',
];

export class RankNotifier {

    // TODO
    private static async handleEvent(event: any): Promise<void> {
    }

    static async run(intervalMinutes: number, errorDelayMinutes: number): Promise<void> {
        await BaseTask.runTask(
            intervalMinutes * 60 * 1000,
            errorDelayMinutes * 60 * 1000,
            this.name,
            async () => {
                const api = await OsuApiService.v2.getApiInstance();
                const lastEventId = await StatsRepository.getEventCursor();

                const newEvents: any[] = [];
                let page = 1;

                outer: while (true) {
                    const result = await api.getBeatmapsetEvents(
                        {},
                        EVENT_TYPES,
                        {
                            limit: 50,
                            page
                        }
                    ) as any;

                    const events: any[] = result?.events ?? [];
                    if (events.length === 0)
                        break;

                    // first run, start at the newest event
                    if (lastEventId === 0) {
                        await StatsRepository.updateEventCursor(events[0].id);
                        console.log(chalk.cyan(`RankNotifier: initialized event cursor at ${events[0].id}`));
                        return;
                    }

                    for (const event of events) {
                        // events are from newest to oldest
                        // once we hit something we've seen, stop
                        if (event.id <= lastEventId)
                            break outer;
                        newEvents.push(event);
                    }

                    // If page returned fewer than 50 results, we've reached the end
                    if (events.length < 50)
                        break;
                    page++;
                }

                // Reverse so we process from oldest to newest
                newEvents.reverse();

                let newHighestId = lastEventId;
                let notified = 0;
                const refreshIds = new Set<number>();

                for (const event of newEvents) {
                    if (event.id > newHighestId) {
                        newHighestId = event.id;
                    }

                    await RankNotifier.handleEvent(event);

                    const eventBeatmapsetId = event.beatmapset?.id as number | undefined;
                    if (eventBeatmapsetId && METADATA_TYPES.has(event.type)) {
                        refreshIds.add(eventBeatmapsetId);
                    }

                    if (!TRACKED_TYPES.has(event.type))
                        continue;

                    try {
                        await WebhookService.sendRankEmbed(event);
                        notified++;
                        await new Promise(r => setTimeout(r, 500));
                    } catch (err) {
                        console.warn(chalk.yellow(`RankNotifier: failed to send embed for event ${event.id}:`), err instanceof Error ? err.message : err);
                    }

                    // Download ranked/loved maps immediately and notify
                    if (DOWNLOAD_TYPES.has(event.type)) {
                        const beatmapsetId = event.beatmapset?.id as number | undefined;
                        if (beatmapsetId) {
                            try {
                                console.log(chalk.cyan(`RankNotifier: downloading beatmapset ${beatmapsetId} (${event.type})...`));
                                await BeatmapsetController.fetchBeatmapsetFromOsu(beatmapsetId, true);
                                await WebhookService.sendDownloadEmbed(event);
                                console.log(chalk.green(`RankNotifier: downloaded and notified beatmapset ${beatmapsetId}`));
                            } catch (dlErr) {
                                console.warn(chalk.yellow(`RankNotifier: failed to download beatmapset ${beatmapsetId}:`), dlErr instanceof Error ? dlErr.message : dlErr);
                            }
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }
                }

                for (const beatmapsetId of refreshIds) {
                    await BeatmapsetController.fetchBeatmapsetFromOsu(beatmapsetId, false);
                    await new Promise(r => setTimeout(r, 500));
                }
                if (refreshIds.size > 0) {
                    console.log(chalk.cyan(`RankNotifier: refreshed metadata for ${refreshIds.size} beatmapset(s)`));
                }

                if (newHighestId > lastEventId) {
                    await StatsRepository.updateEventCursor(newHighestId);
                }

                if (notified > 0) {
                    console.log(chalk.green(`RankNotifier: sent ${notified} notification(s), cursor: ${newHighestId}`));
                } else {
                    console.log(chalk.gray(`RankNotifier: no new rank/love events (cursor: ${newHighestId}, pages fetched: ${page})`));
                }
            }
        );
    }
}
