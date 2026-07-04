import { Context, Router } from "https://deno.land/x/oak@v17.2.0/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import authMiddleware from "../utils/auth_middleware.ts";
// import { Chapter } from "../schemas/chapter.ts";

import { downloadGithubFolder } from "../utils/configUpdater.ts";
import { allowRegistration, setAllowRegistration } from "../utils/config.ts";
import { Categorties } from "../schemas/categories.ts";
import { broadcastMessage } from "../classes/websockets.ts";
import { SourceSearch } from "../models/source_search.ts";
import { ClientConfig } from "../schemas/client_config.ts";
import { ChapterMeta } from "../schemas/chapter_meta.ts";
import { parserRegistry } from "../classes/parser-registry.ts";
import { ChapterListItem } from "../models/Chapters.ts";
import { Details } from "../models/Details.ts";

const apiRouter = new Router({ prefix: "/api" });

//METHODS

apiRouter.get("/canRegister", (context) => {
  context.response.body = { canRegister: allowRegistration };
});

apiRouter.get("/configs", async (context) => {
  const clientType = context.request.url.searchParams.get("type");

  if (!clientType) {
    const configs = await dbSqLiteHandler.getAllClientConfigs();
    context.response.body = configs;
    return;
  }

  const config = await dbSqLiteHandler.getClientConfig(clientType);

  context.response.body = config;
});

apiRouter.post("/config", authMiddleware, async (context) => {
  const { type, version, url } = await context.request.body.jsonOrEmpty();

  if (!type || !version) {
    context.response.status = 400;
    context.response.body = { error: "Client type and version are required" };
    return;
  }

  const config = new ClientConfig(version, type, url);
  await dbSqLiteHandler.insertConfig(version, type, url);

  context.response.body = config;
});

apiRouter.post("/canRegister", authMiddleware, async (context) => {
  const { canRegister } = await context.request.body.jsonOrEmpty();

  const userLevel = context.state.user.user.userlevel;

  if (userLevel != 0) {
    context.response.status = 403;
    context.response.body = { error: "You do not have permission to change registration settings" };
    return;
  }

  if (typeof canRegister !== "boolean") {
    context.response.status = 400;
    context.response.body = { error: "canRegister must be a boolean" };
    return;
  }

  setAllowRegistration(canRegister);
  context.response.body = { status: "Registration setting updated", canRegister: allowRegistration };
});

apiRouter.get("/sources", authMiddleware, (context) => {
  const plugins = parserRegistry.listSources();

  context.response.body = plugins;
});

apiRouter.get("/latest", authMiddleware, async (context) => {
  let source: string | null | undefined = null;
  let page: number | null | undefined = null;

  try {
    source = context.request.url.searchParams.get("source");
    page = parseInt(context.request.url.searchParams.get("page") || "1");
  } catch (e) {
    console.error(e);
  }

  if (source == undefined) {
    context.response.body = { error: "Source is required" };
    context.response.status = 400;
    return;
  }
  const sourceParser = await parserRegistry.getOrLoadParser(source);
  if (sourceParser) {
    const parserResults = await sourceParser.getLatest(page ?? 1);
    context.response.body = parserResults;
    return;
  }
  context.response.body = { error: "Parser not found for source", "available sources": parserRegistry.listSources() };
});

apiRouter.post("/search", authMiddleware, async (context) => {
  const { source, page = 1, query } = await context.request.body.jsonOrEmpty();

  console.log("source: ", source, " | page: ", page, " | query: ", query);

  const sourceParser = await parserRegistry.getOrLoadParser(source);
  if (sourceParser) {
    const parserResults = await sourceParser.search(query, page);
    context.response.body = parserResults;
    return;
  }
  context.response.body = { error: "Parser not found for source", "available sources": parserRegistry.listSources() };
});

apiRouter.post("/searchMultiple", authMiddleware, async (context) => {
  const { searchPayload } = await context.request.body.jsonOrEmpty();

  if (!searchPayload || typeof searchPayload !== "object") {
    context.response.status = 400;
    context.response.body = { error: "Search payload is required and must be an object" };
    return;
  }

  const searchPayloadData: Array<SourceSearch> = SourceSearch.fromJsonList(searchPayload);

  for (const payloadData of searchPayloadData) {
    try {
      const source = payloadData.source;
      const query = payloadData.query;

      const sourceParser = await parserRegistry.getOrLoadParser(source);
      if (sourceParser) {
        const parserResults = await sourceParser.search(query, 1);
        payloadData.searchResult = parserResults;
        context.response.body = parserResults;
      }
    } catch (error) {
      console.error(`Error processing search for source: ${payloadData.source}`, error);
    }
  }

  context.response.body = searchPayloadData;
});

apiRouter.post("/novel", authMiddleware, async (context) => {
  const { source, url, additionalProps, cacheData = true, clearCache = false } = await context.request.body.jsonOrEmpty();

  if (!url || !source) {
    context.response.body = { error: "Novel Url and Source is required" };
    context.response.status = 400;
    return;
  }

  const sourceParser = await parserRegistry.getOrLoadParser(source);
  if (!sourceParser) {
    context.response.body = { error: "Parser not found for source", "available sources": parserRegistry.listSources() };
    return;
  }

  if (clearCache == false && cacheData == true) {
    // Check if chapters are already cached
    const cachedNovel = await dbSqLiteHandler.getCachedNovel(url, source);
    if (cachedNovel != null) {
      console.log("Returning cached novel for source:", source, "and url:", url);
      context.response.body = cachedNovel;
      return;
    }
  }

  const parserResults = await sourceParser.getNovel(url, additionalProps);
  if (!parserResults) {
    context.response.status = 404;
    context.response.body = { error: "Novel not found for the given URL and source" };
    return;
  }
  context.response.body = parserResults;

  if (clearCache) {
    // Clear the cache for this source and url
    console.log("Clearing cache for source:", source, "and url:", url);
    await dbSqLiteHandler.clearChaptersCache(url, source);
  }
  if (cacheData == true) {
    const novelMeta = NovelMeta.fromJSON(parserResults.toJSON());
    await dbSqLiteHandler.insertNovelMeta(novelMeta);
  }

  context.response.body = parserResults;
});

apiRouter.post("/chapters", authMiddleware, async (context) => {
  const { source, url, additionalProps, cacheData = true, clearCache = false } = await context.request.body.jsonOrEmpty();

  if (!url || !source) {
    context.response.body = { error: "Novel Url and Source are required" };
    context.response.status = 404;
    return;
  }

  const sourceParser = await parserRegistry.getOrLoadParser(source);
  if (!sourceParser) {
    context.response.body = { error: "Parser not found for source", "available sources": parserRegistry.listSources() };
    return;
  }

  if (clearCache == false && cacheData == true) {
    // Check if chapters are already cached
    const cachedChapters = await dbSqLiteHandler.getCachedChapters(url, source);
    if (cachedChapters && cachedChapters.length > 0) {
      console.log("Returning cached chapters for source:", source, "and url:", url);
      context.response.body = cachedChapters;
      return;
    }
  }

  let page = 1;
  const chapters: ChapterListItem[] = [];

  const parserResults = await sourceParser.getChapters(url, page, additionalProps);
  chapters.push(...parserResults.chapters);

  if (parserResults.lastPage > 1) {
    page++;
    while (page <= parserResults.lastPage) {
      const nextPageResults = await sourceParser.getChapters(url, page);
      chapters.push(...nextPageResults.chapters);
      page++;
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay of 1 second between requests
    }
  }

  if (cacheData == true && chapters.length > 0) {
    const existingChapters = await dbSqLiteHandler.getCachedChapters(url, source);
    const novelChapters: ChapterMeta[] = chapters.map((chapter) => ChapterMeta.fromJSON(chapter.toJSON()));
    const newChapters: ChapterMeta[] = novelChapters.filter(
      (chapter) => !existingChapters.some((c: ChapterMeta) => c.url === chapter.url),
    );
    if (newChapters.length > 0) {
      await dbSqLiteHandler.insertChapterMetaBulk(newChapters);
    }
  }

  if (chapters.length === 0) {
    context.response.status = 404;
    context.response.body = { error: "No chapters found for the given URL and source" };
    return;
  }

  context.response.body = chapters;
});

apiRouter.post("/chapter", authMiddleware, async (context) => {
  const { source, url, additionalProps } = await context.request.body.jsonOrEmpty();

  if (!url) {
    context.response.body = { error: "Chapter Path is required" };
    context.response.status = 404;
    return;
  }

  const sourceParser = await parserRegistry.getOrLoadParser(source);
  if (!sourceParser) {
    context.response.body = { error: "Parser not found for source", "available sources": parserRegistry.listSources() };
    return;
  }

  const result = await sourceParser.getChapter(url, additionalProps);

  context.response.body = result;
});

apiRouter.get("/updatePlugins", authMiddleware, async (context) => {
  broadcastMessage(new Map().set("type", "updatePlugins").set("message", `Updating Plugins Started`));
  try {
    await downloadGithubFolder(
      "CyferShepard/novel_reader_plugins", // repo
      "configs", // folder url in repo
      "main", // branch
      "./src/plugins", // local destinationto send messages
    );
  } catch (e) {
    console.error("Error updating plugins:", e);
    broadcastMessage(new Map().set("type", "updatePlugins").set("message", `Error updating plugins`));
    context.response.status = 500;
    context.response.body = { error: "Failed to update plugins" };
    return;
  }
  broadcastMessage(new Map().set("type", "updatePlugins").set("message", `Updating Plugins Completed`));

  context.response.status = 200;
  context.response.body = { status: "Project configs updated" };
  return;
});

apiRouter.get("/users", authMiddleware, async (context) => {
  const userLevel = context.state.user.user.userlevel;

  if (userLevel != 0) {
    context.response.status = 403;
    context.response.body = { error: "You do not have permission to view users" };
    return;
  }

  const users = await dbSqLiteHandler.getAllUser();
  context.response.body = users;
});

apiRouter.get("/updates", authMiddleware, async (context) => {
  const page = parseInt(context.request.url.searchParams.get("page") || "1");
  const pageSize = parseInt(context.request.url.searchParams.get("pageSize") || "10");
  const updates = await dbSqLiteHandler.getLastUpdatedChapters(context.state.user.username, page, pageSize);
  context.response.body = updates;
});

apiRouter.get("/categories", authMiddleware, async (context) => {
  const categories = await dbSqLiteHandler.getCategories(context.state.user.username);
  context.response.body = categories;
});

apiRouter.post("/categories", authMiddleware, async (context) => {
  const { name } = await context.request.body.jsonOrEmpty();

  if (!name || typeof name !== "string") {
    context.response.status = 400;
    context.response.body = { error: "Category name is required and must be a string" };
    return;
  }

  try {
    const categories = await dbSqLiteHandler.getCategories(context.state.user.username);
    const latestPosition = categories.length > 0 ? Math.max(...categories.map((cat: Categorties) => cat.position)) : 0;
    if (categories.some((cat: Categorties) => cat.name === name)) {
      context.response.status = 400;
      context.response.body = { error: "Category with this name already exists" };
      return;
    }
    const category = new Categorties(name, context.state.user.username, latestPosition + 1);
    await dbSqLiteHandler.insertCategories(category);
    context.response.status = 200;
  } catch (e) {
    console.error("Error inserting category:", e);
    context.response.status = 500;
    context.response.body = { error: "Failed to create category" };
  }
});

apiRouter.delete("/categories", authMiddleware, async (context) => {
  const { name } = await context.request.body.jsonOrEmpty();

  if (!name || typeof name !== "string") {
    context.response.status = 400;
    context.response.body = { error: "Category name is required and must be a string" };
    return;
  }

  try {
    const categories: Categorties[] = await dbSqLiteHandler.getCategories(context.state.user.username);
    const defaultCategory = categories.find((cat: Categorties) => cat.position === 0);
    if (!defaultCategory) {
      context.response.status = 500;
      context.response.body = { error: "Default category not found" };
      return;
    }
    if (!categories.some((cat: Categorties) => cat.name === name)) {
      context.response.status = 404;
      context.response.body = { error: "Category not found" };
      return;
    }
    await dbSqLiteHandler.deleteCategories(name, context.state.user.username);
    await dbSqLiteHandler.updateCategoryLinkName(context.state.user.username, defaultCategory!.name, name);
    context.response.status = 200;
    context.response.body = { status: "Category deleted successfully" };
  } catch (e) {
    console.error("Error deleting category:", e);
    context.response.status = 500;
    context.response.body = { error: "Failed to delete category" };
  }
});

apiRouter.delete("/imageCache", authMiddleware, async (context: Context) => {
  try {
    const { url } = await context.request.body.jsonOrEmpty();

    const userLevel = context.state.user.user.userlevel;

    if (userLevel && userLevel != 0) {
      context.response.status = 403;
      context.response.body = { error: "You do not have permission to clear the image cache" };
      return;
    }

    if (url && typeof url === "string") {
      await dbSqLiteHandler.deleteImageCache(url);
      context.response.status = 200;
      context.response.body = { status: "Image cache deleted successfully for url: " + url };
      return;
    }

    await dbSqLiteHandler.clearImageCache();
    context.response.status = 200;
    context.response.body = { status: "Image cache cleared successfully" };
  } catch (e) {
    console.error("Error clearing image cache:", e);
    context.response.status = 500;
    context.response.body = { error: "Failed to clear image cache" };
  }
});

export default apiRouter;
