import { Context, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import authMiddleware from "../utils/auth_middleware.ts";
import { Chapter } from "../schemas/chapter.ts";
import { History } from "../schemas/history.ts";
import { parseQuery, ScraperPayload, ScraperResponse } from "../classes/api-parser.ts";
import { getPayload, getPlugins, getSource, PLUGINS } from "../classes/payload-helper.ts";
import { downloadGithubFolder } from "../utils/configUpdater.ts";
import { allowRegistration, setAllowRegistration } from "../utils/config.ts";

const apiRouter = new Router({ prefix: "/api" });

//METHODS
function replaceKeys(template: string, values: Record<string, unknown>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => (values[key] !== undefined ? String(values[key]) : ""));
}

async function getChapter(context: Context, url: string, source: string): Promise<Record<string, unknown> | null> {
  const payload: ScraperPayload | null = await getPayload("chapter", source);
  if (!payload) {
    context.response.status = 404;
    context.response.body = { error: "Payload not found for details", "available payloads": PLUGINS };
    return null;
  }

  payload.url = payload.url.replace("${0}", url);

  const response: ScraperResponse | null = await parseQuery(payload);
  const results = response?.results && response?.results.length > 0 ? response.results[0] : null;
  return results;
}

async function getNovel(context: Context, url: string, source: string): Promise<Record<string, unknown> | null> {
  const payload: ScraperPayload | null = await getPayload("details", source);
  if (!payload) {
    context.response.status = 404;
    context.response.body = { error: "Payload not found for details", "available payloads": PLUGINS };
    return null;
  }

  payload.url = payload.url.replace("${0}", url);

  const response: ScraperResponse | null = await parseQuery(payload);
  const results = response?.results && response?.results.length > 0 ? response.results[0] : null;
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

apiRouter.post("/search", authMiddleware, async (context) => {
  const { source, searchTerm, page = 1 } = await context.request.body.json();

  if (!searchTerm) {
    context.response.status = 400;
    context.response.body = { error: "Search Term is required" };
    return;
  }

  const payload: ScraperPayload | null = await getPayload("search", source);
  if (!payload) {
    context.response.status = 404;
    context.response.body = { error: "Payload not found for search", "available payloads": PLUGINS };
    return;
  }

  if (payload.type === "POST") {
    if (payload.body instanceof FormData) {
      payload.body.set("searchkey", searchTerm);
    } else if (payload.body && typeof payload.body === "object") {
      (payload.body as Record<string, unknown>)["searchkey"] = searchTerm;
    }
  }
  payload.url = payload.url.replace("${0}", encodeURIComponent(searchTerm));

  const jsonpayload = JSON.stringify(payload.toJson());
  console.log(jsonpayload);

  const response: ScraperResponse | null = await parseQuery(payload);
  const results = response?.results && response?.results.length > 0 ? response.results[0]["results"] : null;
  console.log("response: " + results);
  context.response.body = !Array.isArray(results) ? [results] : results || [];
});

apiRouter.post("/novel", authMiddleware, async (context) => {
  const { source, url } = await context.request.body.json();

  console.log("/novel", source, url);

  if (!url) {
    context.response.body = { error: "Novel Path is required" };
    context.response.status = 400;
    return;
  }

  const results: Record<string, unknown> | null = await getNovel(context, url, source);
  if (!results) {
    return;
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

  payload.url = payload.url.replace("${0}", url);

  if (additionalProps && typeof additionalProps === "object" && Object.keys(additionalProps).length > 0) {
    payload.url = replaceKeys(payload.url, additionalProps);
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

  if (clearCache && results.length > 0) {
    // Clear the cache for this source and url
    console.log("Clearing cache for source:", source, "and url:", url);
    await dbSqLiteHandler.clearChaptersCache(url, source);
  }
  if (cacheData == true && results.length > 0) {
    const novelMeta = new NovelMeta(source, url, "", "", "", "", "", []);
    const novelChapters: Chapter[] = results.map((chapter) => Chapter.fromJSON(chapter));
    console.log("Caching chapters for novel:", novelMeta.title);
    await dbSqLiteHandler.insertChapterMetaBulk(novelChapters, novelMeta);
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

export default apiRouter;
