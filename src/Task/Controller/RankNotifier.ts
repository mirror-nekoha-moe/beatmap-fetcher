import chalk from 'chalk';
import { BaseTask } from '@Task/BaseTask';
import { OsuApiService } from '@Service/OsuApiService';
import { StatsRepository } from '@Domain/Stats/Repository/StatsRepository';
import { BeatmapsetController } from '@Domain/Beatmapset/Controller/BeatmapsetController';
import { Environment } from '@Bootstrap/Environment';

const TRACKED_TYPES = new Set(['rank', 'love', 'qualify', 'disqualify', 'remove_from_loved']);
const STATUS_TYPES = new Set(['qualify', 'disqualify', 'remove_from_loved']);
const DOWNLOAD_TYPES = new Set(['rank', 'love']);

const EMBED_COLOR: Record<string, number> = {
    rank: 0x66ccff,
    love: 0xff66aa,
    qualify: 0x00FF00,
    disqualify: 0xff0000,
    remove_from_loved: 0xff0000,
};

const TYPE_LABEL: Record<string, string> = {
    rank: 'Ranked',
    love: 'Loved',
    qualify: 'Qualified',
    disqualify: 'Disqualified',
    remove_from_loved: 'Removed from Loved',
};

export class RankNotifier {

    private static async sendEmbed(event: any): Promise<void> {

        const type = event.type as string;
        const isStatusEvent = STATUS_TYPES.has(type);

        // Check if webhook url exists, else abort
        const webhookUrl = isStatusEvent
            ? Environment.env.MIRROR_LOG_STATUS
            : Environment.env.MIRROR_LOG_MAPSET;
        if (!webhookUrl) return;

        const beatmapset = event.beatmapset as any;
        const title = beatmapset.title_unicode || beatmapset.title;
        const artist = beatmapset.artist_unicode || beatmapset.artist;
        const creator = beatmapset.creator ?? '/';
        const id = beatmapset.id as number;
        const cover = beatmapset.covers?.['cover@2x'] ?? beatmapset.covers?.cover ?? null;

        const embed: Record<string, any> = {
            title: `${TYPE_LABEL[type] ?? type}: ${artist} - ${title}`,
            url: `https://osu.ppy.sh/beatmapsets/${id}`,
            color: EMBED_COLOR[type] ?? 0xffffff,
            fields: [
                {
                    name: 'Mapper',
                    value: `[${creator}](https://osu.ppy.sh/users/${beatmapset.user_id})`,
                    inline: true
                },
                {
                    name: 'Status',
                    value: `${TYPE_LABEL[type] ?? type}`,
                    inline: true
                },
            ],
            footer: {
                text: `ID: ${id}`
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

    private static async sendDownloadEmbed(event: any): Promise<void> {
        const webhookUrl = Environment.env.MIRROR_LOG_DOWNLOAD;
        if (!webhookUrl) return;

        const type = event.type as string;
        const beatmapset = event.beatmapset as any;
        const title = beatmapset.title_unicode || beatmapset.title;
        const artist = beatmapset.artist_unicode || beatmapset.artist;
        const creator = beatmapset.creator ?? '/';
        const id = beatmapset.id as number;
        const cover = beatmapset.covers?.['cover@2x'] ?? beatmapset.covers?.cover ?? null;
        const mirrorBase = (Environment.env.MIRROR_BASE_URL ?? '').replace(/\/$/, '');

        const mirrorLinks = mirrorBase
            ? `[Download](${mirrorBase}/api/download/${id}) • [No Video](${mirrorBase}/api/download/${id}?noVideo=1) • [Mirror Page](${mirrorBase}/beatmapset/${id})`
            : `[osu!direct](osu://s/${id})`;

        const embed: Record<string, any> = {
            title: `Downloaded: ${artist} - ${title}`,
            url: mirrorBase ? `${mirrorBase}/beatmapset/${id}` : `https://osu.ppy.sh/beatmapsets/${id}`,
            color: EMBED_COLOR[type] ?? 0xffffff,
            fields: [
                {
                    name: 'Mapper',
                    value: `[${creator}](https://osu.ppy.sh/users/${beatmapset.user_id})`,
                    inline: true
                },
                {
                    name: 'Status',
                    value: `${TYPE_LABEL[type] ?? type}`,
                    inline: true
                },
                {
                    name: 'Links',
                    value: mirrorLinks,
                    inline: false
                },
            ],
            footer: {
                text: `ID: ${id}`
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
                        await RankNotifier.sendEmbed(event);
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
                                await RankNotifier.sendDownloadEmbed(event);
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
