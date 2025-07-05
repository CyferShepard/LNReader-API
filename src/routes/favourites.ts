import { Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { NovelMeta } from "../schemas/novel_meta.ts";
import { Favourite } from "../schemas/favourites.ts";
import authMiddleware from "../utils/auth_middleware.ts";
import { FavouriteWithNovelMeta } from "../schemas/favouritesWithNovelMeta.ts";
import { Categorties } from "../schemas/categories.ts";

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

  const getAllUniqueFavourites = await dbSqLiteHandler.getAllUniqueFavourites();

  if (getAllUniqueFavourites.length === 0) {
    await dbSqLiteHandler.deleteHistoryForNovel(url, source);
    await dbSqLiteHandler.deleteChapterMetaForNovel(url, source);
    const novelMeta = await dbSqLiteHandler.getCachedNovel(url, source);
    if (novelMeta) {
      await dbSqLiteHandler.deleteImageCache(novelMeta.cover);
    }
    await dbSqLiteHandler.deleteNovelMeta(url, source);
  } else {
    await dbSqLiteHandler.deleteHistoryForNovelByUser(url, source, context.state.user.username);
  }

  context.response.status = 200;
});

favouritesRouter.post("/setCategories", authMiddleware, async (context) => {
  const { categories, url, source } = await context.request.body.json();

  if (!categories || !url || !source) {
    context.response.body = { error: "Categories, Url and Source are required" };
    context.response.status = 400;
    return;
  }

  if (!Array.isArray(categories)) {
    context.response.body = { error: "Categories must be an array" };
    context.response.status = 400;
    return;
  }

  if (categories.length === 0) {
    context.response.body = { error: "Categories cannot be empty" };
    context.response.status = 400;
    return;
  }

  const novelMeta = await dbSqLiteHandler.getCachedNovel(url, source);
  if (!novelMeta) {
    context.response.body = { error: "Novel not found" };
    context.response.status = 404;
    return;
  }

  const existingCategories = await dbSqLiteHandler.getCategories(context.state.user.username);
  const maxPosition = existingCategories.length > 0 ? Math.max(...existingCategories.map((cat: Categorties) => cat.position)) : 0;

  const existingCategoryNames = existingCategories.map((cat: Categorties) => cat.name);
  const newCategories: Categorties[] = [];
  for (const categoryName of categories) {
    if (!existingCategoryNames.includes(categoryName)) {
      newCategories.push(new Categorties(categoryName, context.state.user.username, maxPosition + 1));
    }
  }

  if (newCategories.length > 0) {
    await dbSqLiteHandler.insertCategoriesBulk(newCategories);
  }

  await dbSqLiteHandler.insertCategoryLinkBulk(context.state.user.username, source, url, categories);
  context.response.status = 200;
});

export default favouritesRouter;
