import { Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import { Favourite } from "../schemas/favourites.ts";
import authMiddleware from "../utils/auth_middleware.ts";
import { FavouriteWithNovelMeta } from "../schemas/favouritesWithNovelMeta.ts";

const favouritesRouter = new Router({ prefix: "/favourites" });

//Favourites
favouritesRouter.get("/get", authMiddleware, async (context) => {
  const url = context.request.url.searchParams.get("url");
  const source = context.request.url.searchParams.get("source");
  if (url != null && source != null) {
    const response: FavouriteWithNovelMeta[] | null = await dbSqLiteHandler.getFavourites(
      context.state.user.username,
      url,
      source
    );
    return (context.response.body = response);
  }

  const response: FavouriteWithNovelMeta[] | null = await dbSqLiteHandler.getFavourites(context.state.user.username);

  context.response.body = response;
});

favouritesRouter.post("/insert", authMiddleware, async (context) => {
  const { novelMeta } = await context.request.body.json();

  if (!novelMeta) {
    context.response.body = { error: "All Fields are required" };
    context.response.status = 400;
    return;
  }

  const novelData = new NovelMeta(
    novelMeta.source,
    novelMeta.url,
    novelMeta.cover,
    novelMeta.title,
    novelMeta.summary,
    novelMeta.author,
    novelMeta.status,
    novelMeta.genres,
    novelMeta.lastUpdate ?? "Unknown"
  );
  await dbSqLiteHandler.insertNovelMeta(novelData);

  const favourite: Favourite = new Favourite(context.state.user.username, novelMeta.source, novelMeta.url, new Date());

  await dbSqLiteHandler.insertFavourite(favourite);

  context.response.status = 200;
});

favouritesRouter.delete("/delete", authMiddleware, async (context) => {
  const { url, source } = await context.request.body.json();

  if (!url || !source) {
    context.response.body = { error: "Url and Source is required" };
    context.response.status = 400;
    return;
  }

  await dbSqLiteHandler.deleteFavourite(url, source, context.state.user.username);

  context.response.status = 200;
});

export default favouritesRouter;
