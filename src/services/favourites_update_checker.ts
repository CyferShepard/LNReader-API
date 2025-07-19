import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { Chapter } from "../schemas/chapter.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import { getPayload } from "../classes/payload-helper.ts";
import { parseQuery } from "../classes/api-parser.ts";
import { broadcastMessage } from "../classes/websockets.ts";
import { downloadGithubFolder } from "../utils/configUpdater.ts";

export class FavouritesUpdateChecker {
  private intervalId: number | undefined;

  constructor(private intervalMs: number = 60 * 60 * 1000) {} // default: 1 hour

  public async start() {
    await downloadGithubFolder(
      "CyferShepard/novel_reader_plugins", // repo
      "configs", // folder url in repo
      "main", // branch
      "./src/plugins" // local destinationto send messages
    );
    this.checkAndUpdate();
    this.intervalId = setInterval(() => this.checkAndUpdate(), this.intervalMs);
    console.log(`[FavouritesUpdateChecker] Started with interval ${this.intervalMs / 1000 / 60} minutes.`);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log("[FavouritesUpdateChecker] Stopped.");
    }
  }

  private async checkAndUpdate() {
    try {
      console.log("[FavouritesUpdateChecker] Checking for updates...");
      broadcastMessage(new Map().set("type", "favouritesUpdateCheck").set("message", "Updating Favourites"));
      const favourites = await dbSqLiteHandler.getAllUniqueFavourites();
      for (const fav of favourites) {
        try {
          // If Favourite has source and url, fetch the full NovelMeta
          //   const novel: NovelMeta | null = await dbSqLiteHandler.getCachedNovel(fav.url, fav.source);
          const novelPayload = await getPayload("details", fav.source);
          if (!novelPayload) {
            console.warn(`[FavouritesUpdateChecker] No payload found for source: ${fav.source}`);
            continue;
          }
          novelPayload.url = novelPayload.url.replace("${0}", fav.url);
          const responseN = await parseQuery(novelPayload);
          const resultsnm = responseN?.results && responseN?.results.length > 0 ? responseN.results[0] : null;
          const novel: NovelMeta | null = resultsnm
            ? NovelMeta.fromJSON(resultsnm)
            : await dbSqLiteHandler.getCachedNovel(fav.url, fav.source);

          if (!novel) {
            console.warn(`[FavouritesUpdateChecker] No novel meta found for: ${fav.url} (${fav.source})`);
            continue;
          }
          novel.source = novel.source ?? fav.source; // Ensure source is set correctly
          novel.url = novel.url ?? fav.url; // Ensure url is set correctly
          await dbSqLiteHandler.insertNovelMeta(novel);

          ///////////Chapter stuff
          const payload = await getPayload("chapters", novel.source);
          if (!payload) {
            console.warn(`[FavouritesUpdateChecker] No payload for source: ${novel.source}`);
            continue;
          }
          let hasPageParam = false;
          try {
            // Use a dummy base if payload.url is relative
            const urlObj = new URL(payload.url);
            hasPageParam = urlObj.searchParams.has("page");
            // deno-lint-ignore no-unused-vars
          } catch (e) {
            // If payload.url is not a valid URL, fallback to string check
            hasPageParam = /[?&]page=/.test(payload.url);
          }

          payload.url = payload.url.replace("${0}", novel.url);

          if (novel.additionalProps && Object.keys(novel.additionalProps).length > 0) {
            payload.url = payload.url.replaceKeys(novel.additionalProps);
          }

          let results: Array<Record<string, unknown>> = [];

          if (hasPageParam) {
            let page: number = 0;
            let maxPage: number = 1;
            const originalUrl = payload.url; // Save the template with "${1}"

            while (page < maxPage) {
              page++;
              payload.url = originalUrl.replace("${1}", `${page}`); // Replace page number in URL
              const response = await parseQuery(payload);
              const _results: Array<Record<string, unknown>> | null =
                response?.results && response?.results.length > 0
                  ? (response.results[0]["chapters"] as Array<Record<string, unknown>>)
                  : null;
              if (maxPage == 1) {
                maxPage = response?.results && response?.results.length > 0 ? (response.results[0]["lastPage"] as number) : 1; // Use maxPage from response or default to 1

                if (maxPage > 1) {
                  page = maxPage - 1; // Set page to maxPage to exit loop if no chapters found
                }
              }
              if (_results && _results.length > 0) {
                results = results.concat(_results);

                console.log("Page:", page, "Max Page:", maxPage, "Results Count:", results.length);
              }
            }
          } else {
            const response = await parseQuery(payload);
            const _results: Array<Record<string, unknown>> | null =
              response?.results && response?.results.length > 0
                ? (response.results[0]["chapters"] as Array<Record<string, unknown>>)
                : null;
            if (_results) {
              results = results.concat(_results);
            }
          }

          const chapters: Chapter[] = results.map((chapter) => Chapter.fromJSON(chapter));

          if (chapters.length == 0) {
            console.log(`[FavouritesUpdateChecker] No chapters found for: ${novel.title}`);
            continue;
          }

          const existingChapters = await dbSqLiteHandler.getCachedChapters(fav.url, fav.source);

          const newChapters: Chapter[] = chapters.filter(
            (chapter) => !existingChapters.some((c: Chapter) => c.url === chapter.url)
          );
          console.log("Caching chapters for novel:", novel.title);

          if (newChapters.length === 0) {
            console.log("[FavouritesUpdateChecker] No new chapters to cache for novel:", novel.title);

            continue;
          }
          console.log(`[FavouritesUpdateChecker] Updated ${newChapters.length} chapters for: ${novel.title}`);
          await dbSqLiteHandler.insertChapterMetaBulk(newChapters, novel);
        } catch (err) {
          console.error(`[FavouritesUpdateChecker] Error updating chapters for favourite:`, err);
        }
      }
      console.log("[FavouritesUpdateChecker] Update check complete.");
      broadcastMessage(new Map().set("type", "favouritesUpdateCheck").set("message", "Favourites Update check complete"));
    } catch (err) {
      console.error("[FavouritesUpdateChecker] Error in checkAndUpdate:", err);
      broadcastMessage(new Map().set("type", "favouritesUpdateCheck").set("message", "Favourites Update check failed"));
    }
  }
}
