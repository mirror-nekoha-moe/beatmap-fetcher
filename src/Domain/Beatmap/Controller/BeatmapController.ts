import { BeatmapRepository } from "@Domain/Beatmap/Repository/BeatmapRepository";

export class BeatmapController {
    static async processBeatmap(rawBeatmapset: any) {
        for (const rawBeatmap of rawBeatmapset.beatmaps) {
            const mappedBeatmap = {
                ...rawBeatmap,
                creator: rawBeatmapset.creator, // Add beatmapset creator to beatmap
            };            
            await BeatmapRepository.insertBeatmap(mappedBeatmap);
        }
    }
}