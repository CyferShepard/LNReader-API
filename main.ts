import { Application, Router, Context, send } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

import PLUGINS from "./src/plugins/index.ts";
import { resolve } from "https://deno.land/std@0.224.0/path/mod.ts";
// import { dbHandler } from "./src/classes/db.ts";
import { dbSqLiteHandler } from "./src/classes/db-sqlite.ts";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt/mod.ts";
import { User } from "./src/schemas/users.ts";
import { History } from "./src/schemas/history.ts";
import { Favourite } from "./src/schemas/favourites.ts";
import { NovelMeta } from "./src/schemas/novel_meta.ts";
import { Chapter } from "./src/schemas/chapters.ts";
import { NovelMetaWithChapters } from "./src/schemas/novel_metaWithChapters.ts";

const SECRET_KEY = await crypto.subtle.generateKey(
  {
    name: "HMAC",
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"]
);

const app = new Application();
const router = new Router();

function getSource(source: string) {
  return PLUGINS.find((p) => {
    p.id == source;
  });
}

// Middleware to check for authorization
async function authMiddleware(context: Context, next: () => Promise<unknown>) {
  const authHeader = context.request.headers.get("Authorization");
  if (!authHeader || authHeader.split(" ").length < 2) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  const token = authHeader.split(" ")[1];

  const user = await dbSqLiteHandler.getUserByToken(token);

  if (!user) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  context.state.user = user;
  await next();
}

async function generateToken(user: User): Promise<string> {
  const payload = {
    username: user.username,
    exp: getNumericDate(60 * 60), // Token expires in 1 hour
  };
  const token = await create({ alg: "HS256", typ: "JWT" }, payload, SECRET_KEY);
  return token;
}

// Plugin stuff

var selectedPlugin = null;

router.get("/", (context) => {
  context.response.body = "Hello, world!";
});

router.get("/image", async (context) => {
  const icon = context.request.url.searchParams.get("icon");

  if (!icon) {
    context.response.body = { error: "Icon is required" };
    return;
  }
  const filePath = resolve(Deno.cwd(), `/src/images/${icon}`);
  try {
    await send(context, filePath, {
      root: Deno.cwd(),
    });
  } catch (error) {
    console.error(error);
    context.response.status = 404;
    context.response.body = { error: "Icon not found" };
  }
});

router.get("/imageProxy", async (context) => {
  const imageUrl = context.request.url.searchParams.get("imageUrl");

  if (!imageUrl) {
    context.response.body = { error: "imageUrl is required" };
    return;
  }
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      context.response.status = response.status;
      context.response.body = { error: "Failed to fetch image" };
      return;
    }

    const contentType = response.headers.get("Content-Type");
    if (!contentType || !contentType.startsWith("image/")) {
      context.response.status = 400;
      context.response.body = { error: "Invalid image URL" };
      return;
    }

    const imageBuffer = await response.arrayBuffer();
    context.response.headers.set("Content-Type", contentType);
    context.response.body = new Uint8Array(imageBuffer);
  } catch (error) {
    console.error(error);
    context.response.status = 500;
    context.response.body = { error: "Internal Server Error" };
  }
});

//auth related endpoints

router.post("/getToken", async (context) => {
  const { username, password } = await context.request.body.json();

  const user = await dbSqLiteHandler.getUser(username);

  if (!user || user.password !== password) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  const token = await generateToken(user);
  await dbSqLiteHandler.insertToken(token, user);
  context.response.body = token;
});

router.post("/logout", authMiddleware, async (context) => {
  const authHeader = context.request.headers.get("Authorization");
  const token = authHeader!.split(" ")[1];

  await dbSqLiteHandler.deleteToken(token);
  context.response.status = 200;
});

router.get("/clearTokens", authMiddleware, async (context) => {
  await dbSqLiteHandler.deleteAllTokens();
  context.response.status = 200;
});

//ln reader endpoints
router.get("/getSources", authMiddleware, async (context) => {
  context.response.body = PLUGINS;
});

router.get("/getActiveSources", authMiddleware, async (context) => {
  context.response.body = { source: selectedPlugin };
});

router.get("/setSource", authMiddleware, async (context) => {
  let source: string | null | undefined = null;
  try {
    source = context.request.url.searchParams.get("source");

    if (source == undefined) {
      selectedPlugin = null;
      context.response.body = { source: selectedPlugin };
    }

    if (source != null) {
      var _selectedPlugin = PLUGINS.find((p) => p.id == source);
      if (_selectedPlugin == undefined) {
        context.response.body = { error: "Source not found", "available sources": PLUGINS.map((s) => s.id) };
        return;
      }
      selectedPlugin = _selectedPlugin;
      context.response.body = { source: selectedPlugin };
    }
  } catch (e) {
    console.log(e);
  }
});

router.post("/searchNovel", authMiddleware, async (context) => {
  const { source, searchTerm, page = 1 } = await context.request.body.json();

  if (!searchTerm) {
    context.response.body = { error: "Search Term are required" };
    return;
  }

  const sourcePlugin = selectedPlugin ?? getSource(source);
  if (!sourcePlugin) {
    context.response.body = { error: "Source not found", "available sources": PLUGINS.map((s) => s.id) };
    return;
  }

  const response = await sourcePlugin.searchNovels(searchTerm, page);
  context.response.body = response;
});

router.post("/getPopular", authMiddleware, async (context) => {
  const { source, page = 1, showLatestNovels = true } = await context.request.body.json();

  if (!source) {
    context.response.body = { error: "Source is required" };
    context.response.status = 400;
    return;
  }

  const sourcePlugin = selectedPlugin ?? getSource(source);

  if (!sourcePlugin) {
    context.response.body = { error: "Source not found", "available sources": PLUGINS.map((s) => s.id) };
    context.response.status = 400;
    return;
  }

  const response = await sourcePlugin.popularNovels(page, { showLatestNovels: showLatestNovels, filters: sourcePlugin.filters });

  context.response.body = response;
});

router.post("/novel", authMiddleware, async (context) => {
  const { source, path } = await context.request.body.json();

  console.log("/novel", source, path);

  if (!source || !path) {
    context.response.body = { error: "Source and Path are required" };
    context.response.status = 400;
    return;
  }

  const sourcePlugin = selectedPlugin ?? getSource(source);

  if (!sourcePlugin) {
    context.response.body = { error: "Source not found", "available sources": PLUGINS.map((s) => s.id) };
    return;
  }

  if (!path) {
    context.response.body = { error: "Path is required" };
    return;
  }

  const response = await sourcePlugin.parseNovel(path);

  if (response == null) {
    context.response.body = { error: "Novel not found" };
    context.response.status = 404;
    return;
  }

  context.response.body = response;
});

function stripHtmlTags(html: string): string {
  return html
    .replace(/<p>/g, "\n\n") // Replace <p> with two new lines
    .replace(/<\/p>/g, "")
    .replace(/<br\s*\/?>/g, "\n") // Replace <br> with a new line
    .replace(/<\/?[^>]+(>|$)/g, ""); // Remove all other HTML tags
}

router.post("/chapter", authMiddleware, async (context) => {
  const { source, path, cleanText = true } = await context.request.body.json();

  const sourcePlugin = selectedPlugin ?? getSource(source);

  if (!sourcePlugin) {
    context.response.body = { error: "Source not found", "available sources": PLUGINS.map((s) => s.id) };
    return;
  }

  if (!path) {
    context.response.body = { error: "Path is required" };
    return;
  }

  console.log("source", source, "path", path);

  const response = await sourcePlugin.parseChapter(path);

  if (cleanText) {
    const strippedContent = stripHtmlTags(response.trim());

    context.response.body = strippedContent.trim();
    return;
  }

  context.response.body = response;
});

//App related enpoints

//history
router.get("/history", authMiddleware, async (context) => {
  let path: string | null | undefined = null;
  let npath: string | null | undefined = null;
  try {
    path = context.request.url.searchParams.get("path");
    npath = context.request.url.searchParams.get("npath");
  } catch (e) {
    console.log(e);
  }

  if (path == undefined) {
    path = null;
  }

  if (npath == undefined) {
    npath = null;
  }

  const response = await dbSqLiteHandler.getHistory(context.state.user.username, path, npath);

  context.response.body = response;
  context.response.headers.set("Content-Type", "application/json");
});

router.post("/history", authMiddleware, async (context) => {
  const { path, page, position, source, novelPath } = await context.request.body.json();

  if (path == null || page == null || position == null || novelPath == null || source == null) {
    context.response.body = { error: "All Fields are required" };
    return;
  }

  if ((await dbSqLiteHandler.getNovelByPath(novelPath)) == null || (await dbSqLiteHandler.getChapterByPath(path)) == null) {
    const sourcePlugin = await getSource(source);
    if (sourcePlugin != null) {
      const response = await sourcePlugin.parseNovel(novelPath);

      const novelData = new NovelMetaWithChapters(
        source,
        response["name"],
        novelPath,
        response["cover"],
        response["summary"],
        response["chapters"].map((c: any) => Chapter.fromResult(response["name"], c))
      );
      await dbSqLiteHandler.insertNovelMeta(novelData);
      if (novelData.chapters) {
        const chapterData = novelData.chapters.find((c: Chapter) => c.path == path);
        if (chapterData) await dbSqLiteHandler.insertChapterMeta(chapterData, novelData);
      }
    }
  }

  const history: History = new History(context.state.user.username, source, path, new Date(), page, position, null, null);

  await dbSqLiteHandler.insertHistory(history);

  context.response.status = 200;
});

//Favourites
router.get("/favourites", authMiddleware, async (context) => {
  const path = context.request.url.searchParams.get("path");
  if (path != null) {
    const novel = await dbSqLiteHandler.getNovelByPath(path);
    return (context.response.body = novel);
  }

  const response: Favourite[] | null = await dbSqLiteHandler.getFavourites(context.state.user.username);

  if (!response) {
    context.response.body = [];
    return;
  }

  const novels = await dbSqLiteHandler.getNovelsByPath(response.map((fav) => fav.path));

  context.response.body = novels;
});

router.post("/favourites", authMiddleware, async (context) => {
  const { source, path } = await context.request.body.json();

  if (!path || !source) {
    context.response.body = { error: "All Fields are required" };
    context.response.status = 400;
    return;
  }

  const sourcePlugin = await getSource(source);
  if (sourcePlugin != null) {
    const response = await sourcePlugin.parseNovel(path);

    const novelData = new NovelMeta(source, response["name"], path, response["cover"], response["summary"]);
    await dbSqLiteHandler.insertNovelMeta(novelData);

    await dbSqLiteHandler.insertChapterMetaBulk(
      response["chapters"].map((c: any) => new Chapter(response["name"], c["name"], c["path"])),
      novelData
    );
  }
  const favourite: Favourite = new Favourite(context.state.user.username, source, path, new Date());

  await dbSqLiteHandler.insertFavourite(favourite);

  context.response.status = 200;
});

router.delete("/favourites", authMiddleware, async (context) => {
  const { path } = await context.request.body.json();

  if (!path) {
    context.response.body = { error: "Path is required" };
    context.response.status = 400;
    return;
  }

  await dbSqLiteHandler.deleteFavourite(path, context.state.user.username);

  context.response.status = 200;
});
// Use the oakCors middleware
app.use(
  oakCors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allow specific methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
  })
);

app.use(router.routes());
app.use(router.allowedMethods());

const port = 8000;
console.log(`Server is running on http://localhost:${port}`);
await app.listen({ port });
