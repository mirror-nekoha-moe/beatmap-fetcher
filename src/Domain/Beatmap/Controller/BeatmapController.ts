import { BeatmapRepository } from "@Domain/Beatmap/Repository/BeatmapRepository";

export class BeatmapController {
    static async processBeatmap(rawBeatmapset: any) {
        for (const rawBeatmap of rawBeatmapset.beatmaps) {
            await BeatmapRepository.insertBeatmap(rawBeatmap);
        }
    }
}