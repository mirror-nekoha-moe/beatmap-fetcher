import { Environment } from '@Bootstrap/Environment';

const STATUS_TYPES = new Set(['qualify', 'disqualify', 'remove_from_loved']);
const UPLOAD_EMBED_COLOR = 0xffcc22;

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

export class WebhookService {
    private static async post(webhookUrl: string, body: Record<string, any>): Promise<void> {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
        });
    }

    static async sendLog(content: string): Promise<void> {
        const webhookUrl = Environment.env.MIRROR_LOG_WEBHOOK;
        if (!webhookUrl) return;

        await this.post(webhookUrl, { content });
    }

    // beatmapset is null if TRACK_ALL_MAPS is off, use event data then
    static async sendUploadEmbed(event: any, beatmapsetId: number, beatmapset: any): Promise<void> {
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

        await this.post(webhookUrl, { embeds: [embed] });
    }

    static async sendRankEmbed(event: any): Promise<void> {
        const type = event.type as string;

        let webhookUrl = Environment.env.MIRROR_LOG_MAPSET;
        if (STATUS_TYPES.has(type)) {
            webhookUrl = Environment.env.MIRROR_LOG_STATUS;
        }
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

        await this.post(webhookUrl, { embeds: [embed] });
    }

    static async sendDownloadEmbed(event: any): Promise<void> {
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

        let mirrorLinks = `[osu!direct](osu://s/${id})`;
        let url = `https://osu.ppy.sh/beatmapsets/${id}`;
        if (mirrorBase) {
            const downloadLink = `[Download](${mirrorBase}/api/download/${id})`;
            const noVideoLink = `[No Video](${mirrorBase}/api/download/${id}?noVideo=1)`;
            const pageLink = `[Mirror Page](${mirrorBase}/beatmapset/${id})`;
            mirrorLinks = `${downloadLink} • ${noVideoLink} • ${pageLink}`;
            url = `${mirrorBase}/beatmapset/${id}`;
        }

        const embed: Record<string, any> = {
            title: `Downloaded: ${artist} - ${title}`,
            url,
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

        await this.post(webhookUrl, { embeds: [embed] });
    }
}