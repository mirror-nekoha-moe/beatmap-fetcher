import { Environment } from '@Bootstrap/Environment';
Environment.initialize();
import { OsuApiService } from "@Service/OsuApiService";
import fs from "fs";
async function main(): Promise<void> {
    let osuApiInstance = await OsuApiService.v2.getApiInstance();

    osuApiInstance.getBeatmapset(2237410).then((beatmapset) => {
        fs.writeFile("json/beatmapset.json", JSON.stringify(beatmapset, null, 2), (err) => {});
    });
};
main();