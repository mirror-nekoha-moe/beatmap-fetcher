import chalk from 'chalk';
import { BaseTask } from '@Task/BaseTask';
import { OsuApiService } from '@Service/OsuApiService';
import { WebhookService } from '@Service/WebhookService';
import { StatsRepository } from '@Domain/Stats/Repository/StatsRepository';
import { BeatmapsetController } from '@Domain/Beatmapset/Controller/BeatmapsetController';

const TRACKED_TYPES = new Set(['rank', 'love', 'qualify', 'disqualify', 'remove_from_loved']);
const DOWNLOAD_TYPES = new Set(['rank', 'love']);

export class RankNotifier {

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
                const MAX_PAGES = 40;

                outer: while (page <= MAX_PAGES) {
                    const result = await api.getBeatmapsetEvents(
                        {
                            min_date: new Date(Date.now() - 1000 * 60 * 60 * 24)
                        },
                        ['rank', 'love', 'qualify', 'disqualify', 'remove_from_loved'],
                        {
                            limit: 50,
                            page
                        }
                    ) as any;

                    const events: any[] = result?.events ?? [];
                    if (events.length === 0)
                        break;

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

                for (const event of newEvents) {
                    if (event.id > newHighestId) {
                        newHighestId = event.id;
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
