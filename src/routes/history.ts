import { Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import authMiddleware from "../utils/auth_middleware.ts";
import { Chapter } from "../schemas/chapter.ts";
import { History } from "../schemas/history.ts";

const historyRouter = new Router({ prefix: "/history" });

//history
historyRouter.get("/get", authMiddleware, async (context) => {
  let url: string | null | undefined = null;
  let novelUrl: string | null | undefined = null;
  try {
    url = context.request.url.searchParams.get("url");
    novelUrl = context.request.url.searchParams.get("novelUrl");
  } catch (e) {
    console.log(e);
  }

  if (url == undefined) {
    url = null;
  }

  if (novelUrl == undefined) {
    novelUrl = null;
  }

  const response = await dbSqLiteHandler.getHistory(context.state.user.username, url, novelUrl);

  context.response.body = response;
  context.response.headers.set("Content-Type", "application/json");
});

historyRouter.post("/insert", authMiddleware, async (context) => {
  const { novel, chapter, page, position } = await context.request.body.json();

  if (novel == null || page == null || position == null || chapter == null) {
    context.response.body = { error: "All Fields are required" };
    return;
  }

  const novelMeta: NovelMeta = NovelMeta.fromJSON(novel);
  const chapterData: Chapter = Chapter.fromJSON(chapter);
  try {
    await dbSqLiteHandler.insertNovelMeta(novelMeta);
    await dbSqLiteHandler.insertChapterMeta(chapterData, novelMeta);

    const history: History = new History(
      context.state.user.username,
      novelMeta.source,
      chapterData.url,
      new Date(),
      page,
      position,
      chapterData,
      novelMeta
    );

    await dbSqLiteHandler.insertHistory(history);
    // await dbSqLiteHandler.deleteHistoryExceptLatest(chapterData, novelMeta, context.state.user.username);

    context.response.status = 200;
    context.response.body = history;
  } catch (e) {
    console.error("Error inserting history:", e);
    context.response.status = 500;
    context.response.body = { error: "Failed to insert history" };
  }
});

historyRouter.post("/insertBulk", authMiddleware, async (context) => {
  const { novel, chapters, page, position } = await context.request.body.json();

  if (novel == null || page == null || position == null || chapters == null) {
    context.response.body = { error: "All Fields are required" };
    return;
  }

  const novelMeta: NovelMeta = NovelMeta.fromJSON(novel);
  const chapterData: Chapter[] = Chapter.fromJSONList(chapters);
  try {
    await dbSqLiteHandler.insertNovelMeta(novelMeta);
    await dbSqLiteHandler.insertChapterMetaBulk(chapterData, novelMeta);

    const history: History[] = chapterData.map(
      (chapter) =>
        new History(context.state.user.username, novelMeta.source, chapter.url, new Date(), page, position, chapter, novelMeta)
    );
    await dbSqLiteHandler.insertHistoryBulk(history);
    // await dbSqLiteHandler.deleteHistoryExceptLatest(chapterData, novelMeta, context.state.user.username);

    context.response.status = 200;
    context.response.body = history;
  } catch (e) {
    console.error("Error inserting history:", e);
    context.response.status = 500;
    context.response.body = { error: "Failed to insert history" };
  }
});

export default historyRouter;
