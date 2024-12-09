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

const sourceMapFilePath = resolve(Deno.cwd(), "sourceMap.json");
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
let sourceMap: { source: string; name: string; icon: string; site: string; language: string; version: string; index: number }[] =
  [];

async function getSource(source: string) {
  if (sourceMap.length === 0) {
    const fileContent = await Deno.readTextFile(sourceMapFilePath);
    sourceMap = JSON.parse(fileContent) as {
      source: string;
      name: string;
      icon: string;
      site: string;
      language: string;
      version: string;
      index: number;
    }[];
  }

  return sourceMap.find((s) => s.source === source);
}

// Middleware to check for authorization
async function authMiddleware(context: Context, next: () => Promise<unknown>) {
  const authHeader = context.request.headers.get("Authorization");
  if (!authHeader) {
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
  const language = context.request.url.searchParams.get("language");
  if (sourceMap.length === 0) {
    await getSource("");
  }

  context.response.body = sourceMap
    .filter((s) => s.language == language || !language)
    .map((s) => {
      return { source: s.source, name: s.name, icon: s.icon, site: s.site, language: s.language, version: s.version };
    });
});

router.post("/searchNovel", authMiddleware, async (context) => {
  const { source, searchTerm, page = 1 } = await context.request.body.json();

  if (!source || !searchTerm) {
    context.response.body = { error: "Source and Search Term are required" };
    return;
  }

  const findSourceIndex = await getSource(source);
  if (!findSourceIndex) {
    context.response.body = { error: "Source not found", "available sources": sourceMap.map((s) => s.source) };
    return;
  }

  const sourcePlugin = PLUGINS[findSourceIndex.index];
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

  const findSourceIndex = await getSource(source);

  if (!findSourceIndex) {
    context.response.body = { error: "Source not found", "available sources": sourceMap.map((s) => s.source) };
    context.response.status = 400;
    return;
  }

  const sourcePlugin = PLUGINS[findSourceIndex.index];

  const response = await sourcePlugin.popularNovels(page, { showLatestNovels: showLatestNovels, filters: sourcePlugin.filters });

  context.response.body = response;
});

router.post("/novel", authMiddleware, async (context) => {
  const { source, path } = await context.request.body.json();

  if (!source || !path) {
    context.response.body = { error: "Source and Path are required" };
    context.response.status = 400;
    return;
  }

  const findSourceIndex = await getSource(source);

  if (!findSourceIndex) {
    context.response.body = { error: "Source not found", "available sources": sourceMap.map((s) => s.source) };
    return;
  }

  if (!path) {
    context.response.body = { error: "Path is required" };
    return;
  }

  const sourcePlugin = PLUGINS[findSourceIndex.index];

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
  const { source, path } = await context.request.body.json();

  const findSourceIndex = await getSource(source);

  if (!findSourceIndex) {
    context.response.body = { error: "Source not found", "available sources": sourceMap.map((s) => s.source) };
    return;
  }

  if (!path) {
    context.response.body = { error: "Path is required" };
    return;
  }

  const sourcePlugin = PLUGINS[findSourceIndex.index];

  const response = await sourcePlugin.parseChapter(path);

  const strippedContent = stripHtmlTags(response.trim());

  context.response.body = strippedContent.trim();
});

//App related enpoints

//history
router.get("/history", authMiddleware, async (context) => {
  const path = context.request.url.searchParams.get("path");

  const response = await dbSqLiteHandler.getHistory(context.state.user.username, path);

  context.response.body = response;
  // context.response.headers.set("Content-Type", "application/json");
});

router.post("/history", authMiddleware, async (context) => {
  const { path, page, position, source, novelPath } = await context.request.body.json();

  if (path == null || page == null || position == null || novelPath == null || source == null) {
    context.response.body = { error: "All Fields are required" };
    return;
  }

  if ((await dbSqLiteHandler.getNovelByPath(novelPath)) == null) {
    const findSourceIndex = await getSource(source);
    if (findSourceIndex != null) {
      const sourcePlugin = PLUGINS[findSourceIndex.index];

      const response = await sourcePlugin.parseNovel(novelPath);

      const novelData = new NovelMeta(source, response["name"], novelPath, response["cover"], response["summary"]);
      await dbSqLiteHandler.insertNovelMeta(novelData);
    }
  }

  const history: History = new History(context.state.user.username, source, path, new Date(), page, position);

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

  const findSourceIndex = await getSource(source);
  if (findSourceIndex != null) {
    const sourcePlugin = PLUGINS[findSourceIndex.index];

    const response = await sourcePlugin.parseNovel(path);

    const novelData = new NovelMeta(source, response["name"], path, response["cover"], response["summary"]);
    await dbSqLiteHandler.insertNovelMeta(novelData);

    await dbSqLiteHandler.insertChapterMetaBulk(
      response["chapters"].map((c: any) => new Chapter(c["name"], c["path"])),
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
