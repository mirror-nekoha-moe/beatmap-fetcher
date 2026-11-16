import Redis from 'ioredis';
import { Environment } from '@Bootstrap/Environment';

// mirror-server subscribes to this and sends it out on /api/ws
const CHANNEL = 'beatmapset_events';

export class EventPublishService {
    private static redis: Redis | null = null;

    private static getClient(): Redis | null {
        if (!Environment.env.REDIS_HOST) {
            return null;
        }

        if (!this.redis) {
            let port = 6379;
            if (Environment.env.REDIS_PORT) {
                port = Number(Environment.env.REDIS_PORT);
            }
            this.redis = new Redis({
                host: Environment.env.REDIS_HOST,
                port,
            });
        }
        return this.redis;
    }

    static async publish(source: string, event: any, beatmapsetId: number | null): Promise<void> {
        const client = this.getClient();
        if (!client) return;

        const message = {
            source,
            type: event.type,
            event,
            beatmapset_id: beatmapsetId,
        };
        await client.publish(CHANNEL, JSON.stringify(message));
    }
}