import { Context, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import authMiddleware from "../utils/auth_middleware.ts";
import { Chapter } from "../schemas/chapter.ts";
import { parseQuery, ScraperPayload, ScraperResponse, configureAstralBrowser, BodyType } from "../classes/api-parser.ts";
import { getPayload, getPlugins, getSource, PLUGINS } from "../classes/payload-helper.ts";
import { downloadGithubFolder } from "../utils/configUpdater.ts";
import { allowRegistration, setAllowRegistration } from "../utils/config.ts";
import { Categorties } from "../schemas/categories.ts";

const apiRouter = new Router({ prefix: "/api" });

//METHODS

function configureBrowser() {
  const browserlessUrl = Deno.env.get("BROWSERLESS_URL");
  const browserlessToken = Deno.env.get("BROWSERLESS_TOKEN");
  if (browserlessToken && browserlessUrl) {
    configureAstralBrowser(browserlessUrl, browserlessToken);
    console.log(`Configured browser with URL: ${browserlessUrl} and token: ${browserlessToken}`);
  }
}
// function replaceKeys(template: string, values: Record<string, unknown>): string {
//   return template.replace(/\$\{(\w+)\}/g, (_, key) => (values[key] !== undefined ? String(values[key]) : ""));
// }

async function getChapter(context: Context, url: string, source: string): Promise<Record<string, unknown> | null> {
  const payload: ScraperPayload | null = await getPayload("chapter", source);
  if (!payload) {
    context.response.status = 404;
    context.response.body = { error: "Payload not found for details", "available payloads": PLUGINS };
    return null;
  }

  if (payload.waitForPageLoad) {
    configureBrowser();
  }

  payload.url = payload.url.replace("${0}", url);

  const response: ScraperResponse | null = await parseQuery(payload);
  const results = response?.results && response?.results.length > 0 ? response.results[0] : null;
  if (results) {
    results.fullUrl = payload.url; // Ensure fullUrl is set to the provided URL
  }
  return results;
}

async function getNovel(context: Context, url: string, source: string): Promise<Record<string, unknown> | null> {
  const payload: ScraperPayload | null = await getPayload("details", source);
  if (!payload) {
    context.response.status = 404;
    context.response.body = { error: "Payload not found for details", "available payloads": PLUGINS };
    return null;
  }
  if (payload.waitForPageLoad) {
    configureBrowser();
  }

  payload.url = payload.url.replace("${0}", url);

  const response: ScraperResponse | null = await parseQuery(payload);
  const results = response?.results && response?.results.length > 0 ? response.results[0] : null;
  if (results) {
    results.fullUrl = payload.url; // Ensure fullUrl is set to the provided URL
  }
  return results;
}

//

apiRouter.get("/canRegister", (context) => {
  context.response.body = { canRegister: allowRegistration };
});

apiRouter.post("/canRegister", authMiddleware, async (context) => {
  const { canRegister } = await context.request.body.json();

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

apiRouter.get("/sources", authMiddleware, async (context) => {
  await getPlugins();
  context.response.body = PLUGINS;
});

apiRouter.get("/latest", authMiddleware, async (context) => {
  let source: string | null | undefined = null;
  let page: number | null | undefined = null;

  try {
    source = context.request.url.searchParams.get("source");
    page = parseInt(context.request.url.searchParams.get("page") || "1");
  } catch (e) {
    console.log(e);
  }

  if (source == undefined) {
    context.response.body = { error: "Source is required" };
    context.response.status = 400;
    return;
  }

  const payload: ScraperPayload | null = await getPayload("latest", source);
  if (!payload) {
    context.response.status = 404;
    context.response.body = { error: "Payload not found for search", "available payloads": PLUGINS };
    return;
  }
  if (payload.waitForPageLoad) {
    configureBrowser();
  }

  payload.url = payload.url.replace("${0}", page!.toString());

  const jsonpayload = JSON.stringify(payload.toJson());
  console.log(jsonpayload);

  const response: ScraperResponse | null = await parseQuery(payload);
  const results = response?.results && response?.results.length > 0 ? response.results[0] : null;

  context.response.body = results || { results: [] };
});

apiRouter.post("/search", authMiddleware, async (context) => {
  const { source, page = 1, searchParams } = await context.request.body.json();

  // if (!searchTerm) {
  //   context.response.status = 400;
  //   context.response.body = { error: "Search Term is required" };
  //   return;
  // }

  const payload: ScraperPayload | null = await getPayload("search", source);
  if (!payload) {
    context.response.status = 404;
    context.response.body = { error: "Payload not found for search", "available payloads": PLUGINS };
    return;
  }
  if (payload.waitForPageLoad) {
    configureBrowser();
  }

  if (payload.type === "POST") {
    if (payload.bodyType === BodyType.FORM_DATA) {
      payload.body = new FormData();

      if (typeof searchParams === "string") {
        const params = new URLSearchParams(searchParams.startsWith("?") ? searchParams.slice(1) : searchParams);
        for (const [key, value] of params.entries()) {
          payload.body.set(key, value);
        }
      }
    } else if (payload.bodyType === BodyType.JSON) {
      if (typeof searchParams === "string") {
        const params = new URLSearchParams(searchParams.startsWith("?") ? searchParams.slice(1) : searchParams);
        for (const [key, value] of params.entries()) {
          (payload.body as Record<string, unknown>)[key] = value;
        }
      }
    }
  } else {
    if (searchParams != null) {
      payload.url = payload.url + searchParams;
    }
  }
  payload.url = payload.url.replace("${1}", page!.toString());

  const jsonpayload = JSON.stringify(payload.toJson());
  console.log(jsonpayload);

  const response: ScraperResponse | null = await parseQuery(payload);
  // const results = response?.results && response?.results.length > 0 ? response.results[0]["results"] : null;
  const results = response?.results && response?.results.length > 0 ? response.results[0] : null;

  context.response.body = results || { results: [] };

  // context.response.body = !Array.isArray(results) && results != undefined ? [results] : results || [];
});

apiRouter.post("/novel", authMiddleware, async (context) => {
  const { source, url, cacheData = true, clearCache = false } = await context.request.body.json();

  console.log("/novel", source, url);

  if (!url || !source) {
    context.response.body = { error: "Novel Url and Source is required" };
    context.response.status = 400;
    return;
  }

  if (clearCache == false && cacheData == true) {
    // Check if chapters are already cached
    const cachedNovel = await dbSqLiteHandler.getCachedNovel(url, source);
    if (cachedNovel != null) {
      console.log("Returning cached novel for source:", source, "and url:", url);
      const payload: ScraperPayload | null = await getPayload("details", source);
      if (payload != null) {
        payload.url = payload.url.replace("${0}", url);
        cachedNovel.fullUrl = payload.url; // Ensure fullUrl is set to the provided URL
      }

      context.response.body = cachedNovel;
      return;
    }
  }

  const results: Record<string, unknown> | null = await getNovel(context, url, source);
  if (!results) {
    return;
  }

  if (clearCache && results != null) {
    // Clear the cache for this source and url
    console.log("Clearing cache for source:", source, "and url:", url);
    await dbSqLiteHandler.clearChaptersCache(url, source);
  }
  if (cacheData == true && results != null) {
    const novelMeta = NovelMeta.fromJSON(results);
    novelMeta.source = source;
    novelMeta.url = novelMeta.url ?? url;

    await dbSqLiteHandler.insertNovelMeta(novelMeta);
  }

  console.log("response: " + results);
  context.response.body = results || [];
});

apiRouter.post("/chapters", authMiddleware, async (context) => {
  const { source, url, additionalProps, cacheData = true, clearCache = false } = await context.request.body.json();

  if (!url || !source) {
    context.response.body = { error: "Novel Url and Source are required" };
    context.response.status = 404;
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

  const payload: ScraperPayload | null = await getPayload("chapters", source);
  if (!payload) {
    context.response.status = 404;
    context.response.body = { error: "Payload not found for chapters", "available payloads": PLUGINS };
    return;
  }
  if (payload.waitForPageLoad) {
    configureBrowser();
  }

  payload.url = payload.url.replace("${0}", url);

  if (additionalProps && typeof additionalProps === "object" && Object.keys(additionalProps).length > 0) {
    payload.url = payload.url.replaceKeys(additionalProps);
  }

  let hasPageParam = false;
  try {
    // Use a dummy base if payload.url is relative
    const urlObj = new URL(payload.url);
    hasPageParam = urlObj.searchParams.has("page");
  } catch (e) {
    // If payload.url is not a valid URL, fallback to string check
    hasPageParam = /[?&]page=/.test(payload.url);
  }

  let results: Array<Record<string, unknown>> = [];

  if (hasPageParam) {
    let page: number = 0;
    let maxPage: number = 1;
    const originalUrl = payload.url; // Save the template with "${1}"

    while (page < maxPage) {
      page++;
      payload.url = originalUrl.replace("${1}", `${page}`); // Replace page number in URL
      const response: ScraperResponse | null = await parseQuery(payload);
      const _results: Array<Record<string, unknown>> | null =
        response?.results && response?.results.length > 0
          ? (response.results[0]["chapters"] as Array<Record<string, unknown>>)
          : null;
      if (maxPage == 1) {
        maxPage = response?.results && response?.results.length > 0 ? (response.results[0]["lastPage"] as number) : 1; // Use maxPage from response or default to 1
      }
      if (_results && _results.length > 0) {
        results = results.concat(_results);

        console.log("Page:", page, "Max Page:", maxPage, "Results Count:", results.length);
      }
    }
  } else {
    const response: ScraperResponse | null = await parseQuery(payload);
    const _results: Array<Record<string, unknown>> | null =
      response?.results && response?.results.length > 0
        ? (response.results[0]["chapters"] as Array<Record<string, unknown>>)
        : null;
    if (_results) {
      results = results.concat(_results);
    }
  }

  // if (clearCache && results.length > 0) {
  //   // Clear the cache for this source and url
  //   console.log("Clearing cache for source:", source, "and url:", url);
  //   await dbSqLiteHandler.clearChaptersCache(url, source);
  // }
  if (cacheData == true && results.length > 0) {
    const existingChapters = await dbSqLiteHandler.getCachedChapters(url, source);
    const novelMeta = new NovelMeta(source, url, "", "", "", "", "", [], "");
    const novelChapters: Chapter[] = results.map((chapter) => Chapter.fromJSON(chapter));
    const newChapters: Chapter[] = novelChapters.filter(
      (chapter) => !existingChapters.some((c: Chapter) => c.url === chapter.url)
    );
    console.log("Caching chapters for novel:", novelMeta.title);
    if (newChapters.length === 0) {
      console.log("No new chapters to cache for novel:", novelMeta.title);
      context.response.body = results;
      return;
    }
    await dbSqLiteHandler.insertChapterMetaBulk(newChapters, novelMeta);
  }
  context.response.body = results;
});

apiRouter.post("/chapter", authMiddleware, async (context) => {
  const { source, url, cleanText = true } = await context.request.body.json();

  if (!url) {
    context.response.body = { error: "Chapter Path is required" };
    context.response.status = 404;
    return;
  }

  const sourcePlugin = getSource(source);

  if (!sourcePlugin) {
    context.response.status = 404;
    context.response.body = { error: "Source not found", "available sources": PLUGINS.map((s) => s.id) };
    return;
  }

  const results: Record<string, unknown> | null = await getChapter(context, url, source);
  if (!results) {
    return;
  }
  console.log("response: " + results);
  context.response.body = results || [];
});

apiRouter.get("/updatePlugins", authMiddleware, async (context) => {
  await downloadGithubFolder(
    "CyferShepard/novel_reader_plugins", // repo
    "configs", // folder url in repo
    "main", // branch
    "./src/plugins" // local destination
  );

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
  const updates = await dbSqLiteHandler.getLastUpdatedChapters(context.state.user.username);
  context.response.body = updates;
});

apiRouter.get("/categories", authMiddleware, async (context) => {
  const categories = await dbSqLiteHandler.getCategories(context.state.user.username);
  context.response.body = categories;
});

apiRouter.post("/categories", authMiddleware, async (context) => {
  const { name } = await context.request.body.json();

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
  const { name } = await context.request.body.json();

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

export default apiRouter;
