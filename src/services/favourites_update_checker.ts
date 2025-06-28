import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { Chapter } from "../schemas/chapter.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import { getPayload } from "../classes/payload-helper.ts";
import { parseQuery } from "../classes/api-parser.ts";

export class FavouritesUpdateChecker {
  private intervalId: number | undefined;

  constructor(private intervalMs: number = 60 * 60 * 1000) {} // default: 1 hour

  public start() {
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
          const payload = await getPayload("chapters", novel.source);
          if (!payload) {
            console.warn(`[FavouritesUpdateChecker] No payload for source: ${novel.source}`);
            continue;
          }
          payload.url = payload.url.replace("${0}", novel.url);
          if (novel.additionalProps && Object.keys(novel.additionalProps).length > 0) {
            payload.url = payload.url.replaceKeys(novel.additionalProps);
          }

          const response = await parseQuery(payload);
          const chapters: Array<Record<string, unknown>> =
            response?.results && response?.results.length > 0
              ? (response.results[0]["chapters"] as Array<Record<string, unknown>>)
              : [];
          if (chapters.length > 0) {
            const novelChapters: Chapter[] = chapters.map((chapter) => Chapter.fromJSON(chapter));
            //   await dbSqLiteHandler.insertChapterMetaBulk(novelChapters, novel);
            console.log(`[FavouritesUpdateChecker] Updated ${novelChapters.length} chapters for: ${novel.title}`);
          } else {
            console.log(`[FavouritesUpdateChecker] No chapters found for: ${novel.title}`);
          }
        } catch (err) {
          console.error(`[FavouritesUpdateChecker] Error updating chapters for favourite:`, err);
        }
      }
      console.log("[FavouritesUpdateChecker] Update check complete.");
    } catch (err) {
      console.error("[FavouritesUpdateChecker] Error in checkAndUpdate:", err);
    }
  }
}
