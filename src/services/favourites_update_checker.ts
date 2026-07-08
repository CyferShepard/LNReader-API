import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
// import { Chapter } from "../schemas/chapter.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import { broadcastMessage } from "../classes/websockets.ts";
import { downloadGithubFolder } from "../utils/configUpdater.ts";
import { Favourite } from "../schemas/favourites.ts";
import { ChapterMeta } from "../schemas/chapter_meta.ts";
import { parserRegistry } from "../classes/parser-registry.ts";

export class FavouritesUpdateChecker {
  private intervalId: number | undefined;

  constructor(private intervalMs: number = 60 * 60 * 1000) {} // default: 1 hour

  public async start() {
    try {
      await downloadGithubFolder(
        "CyferShepard/novel_reader_plugins", // repo
        "configs", // folder url in repo
        "main", // branch
        "./src/plugins", // local destinationto send messages
      );
    } catch (err) {
      console.error("[FavouritesUpdateChecker] Error downloading plugins:", err);
    }
    await parserRegistry.loadParsers();
    console.info(`Loaded parser sources: ${parserRegistry.listSources().join(", ") || "none"}`);
    this.checkAndUpdate();
    this.intervalId = setInterval(() => this.checkAndUpdate(), this.intervalMs);
    console.info(`[FavouritesUpdateChecker] Started with interval ${this.intervalMs / 1000 / 60} minutes.`);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.info("[FavouritesUpdateChecker] Stopped.");
    }
  }

  private async checkAndUpdate() {
    try {
      console.log("[FavouritesUpdateChecker] Checking for updates...");
      broadcastMessage(new Map().set("type", "favouritesUpdateCheck").set("message", "Updating Favourites"));
      const favourites = await dbSqLiteHandler.getAllUniqueFavourites();
      const validSources = parserRegistry.listSources().map((source) => source.name);

      const filteredFavourites = favourites.filter((fav) => validSources.includes(fav.source));

      for (let i = 0; i < filteredFavourites.length; i++) {
        const fav = filteredFavourites[i];

        await this.updateNovel(fav);

        if (i < filteredFavourites.length - 1) {
          const nextFav = filteredFavourites[i + 1];
          if (nextFav.source === fav.source) {
            await new Promise((resolve) => setTimeout(resolve, 500)); // Add a small delay between updates to avoid overwhelming APIs
          }
        }
      }

      console.log("[FavouritesUpdateChecker] Update check complete.");
      broadcastMessage(new Map().set("type", "favouritesUpdateCheck").set("message", "Favourites Update check complete"));
    } catch (err) {
      console.error("[FavouritesUpdateChecker] Error in checkAndUpdate:", err);
      broadcastMessage(new Map().set("type", "favouritesUpdateCheck").set("message", "Favourites Update check failed"));
    }
  }

  private async updateNovel(fav: Favourite) {
    try {
      // If Favourite has source and url, fetch the full NovelMeta
      //   const novel: NovelMeta | null = await dbSqLiteHandler.getCachedNovel(fav.url, fav.source);
      const sourceParser = await parserRegistry.getOrLoadParser(fav.source);
      if (!sourceParser) {
        console.warn(`[FavouritesUpdateChecker] Parser not found for source: ${fav.source}`);
        return;
      }
      const fetchedNovelMeta = await sourceParser.getNovel(fav.url);
      const novel: NovelMeta | null = fetchedNovelMeta
        ? NovelMeta.fromJSON(fetchedNovelMeta)
        : await dbSqLiteHandler.getCachedNovel(fav.url, fav.source);

      if (!novel) {
        console.warn(`[FavouritesUpdateChecker] No novel meta found for: ${fav.url} (${fav.source})`);
        return;
      }
      novel.source = novel.source ?? fav.source; // Ensure source is set correctly
      novel.url = novel.url ?? fav.url; // Ensure url is set correctly
      await dbSqLiteHandler.insertNovelMeta(novel);

      ///////////Chapter stuff
      const chaptersPage1 = await sourceParser.getChapters(fav.url, 1);

      let latestChapters = chaptersPage1.chapters;

      if (chaptersPage1.lastPage > 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Add a small delay between updates to avoid overwhelming APIs

        latestChapters = (await sourceParser.getChapters(fav.url, chaptersPage1.lastPage)).chapters;
      }

      const chapters: ChapterMeta[] = latestChapters.map((chapter) => ChapterMeta.fromJSON(chapter.toJSON()));

      if (chapters.length == 0) {
        console.warn(`[FavouritesUpdateChecker] No chapters found for: ${novel.title}`);
        return;
      }

      const existingChapters = await dbSqLiteHandler.getCachedChapters(fav.url, fav.source);

      const newChapters: ChapterMeta[] = chapters.filter(
        (chapter) => !existingChapters.some((c: ChapterMeta) => c.url === chapter.url),
      );
      console.log("Caching chapters for novel:", novel.title);

      if (newChapters.length === 0) {
        console.log("[FavouritesUpdateChecker] No new chapters to cache for novel:", novel.title);

        return;
      }
      console.log(`[FavouritesUpdateChecker] Updated ${newChapters.length} chapters for: ${novel.title}`);
      await dbSqLiteHandler.insertChapterMetaBulk(newChapters);
    } catch (err) {
      console.error(`[FavouritesUpdateChecker] Error updating chapters for favourite:`, err);
    }
  }
}
