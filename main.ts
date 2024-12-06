import { Application, Router, Context, send } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import PLUGINS from "./src/plugins/index.ts";
import { resolve } from "https://deno.land/std@0.224.0/path/mod.ts";
import { dbHandler } from "./src/classes/db.ts";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt/mod.ts";
import { User } from "./src/schemas/users.ts";
import { History } from "./src/schemas/history.ts";
import { Favourite } from "./src/schemas/favourites.ts";

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
    sourceMap = JSON.parse(fileContent) as { source: string; language: string; index: number }[];
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

  const user = await dbHandler.getUserByToken(token);

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

//auth related endpoints

router.post("/getToken", async (context) => {
  const { username, password } = await context.request.body.json();

  const user = await dbHandler.getUser(username);

  if (!user || user.password !== password) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  const token = await generateToken(user);
  await dbHandler.insertToken(token, user);
  context.response.body = token;
});

router.post("/logout", authMiddleware, async (context) => {
  const authHeader = context.request.headers.get("Authorization");
  const token = authHeader!.split(" ")[1];

  await dbHandler.deleteToken(token);
  context.response.status = 200;
});

router.get("/clearTokens", authMiddleware, async (context) => {
  await dbHandler.deleteAllTokens();
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
  const findSourceIndex = await getSource(source);

  if (!findSourceIndex) {
    context.response.body = { error: "Source not found", "available sources": sourceMap.map((s) => s.source) };
    return;
  }

  const sourcePlugin = PLUGINS[findSourceIndex.index];

  const response = await sourcePlugin.popularNovels(page, { showLatestNovels: showLatestNovels, filters: sourcePlugin.filters });

  context.response.body = response;
});

router.post("/novel", authMiddleware, async (context) => {
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

  const response = await sourcePlugin.parseNovel(path);

  context.response.body = response;
});

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

  context.response.body = response;
});

//App related enpoints

//history
router.get("/history", authMiddleware, async (context) => {
  const path = context.request.url.searchParams.get("path");

  const response = await dbHandler.getHistory(context.state.user.username, path);

  context.response.body = response;
});

router.post("/history", authMiddleware, async (context) => {
  const { path, page, position } = await context.request.body.json();

  if (!path || !page || !position) {
    context.response.body = { error: "All Fields are required" };
    return;
  }

  const history: History = new History(path, new Date(), page, position, context.state.user.username);

  await dbHandler.insertHistory(history);

  context.response.status = 200;
});

//Favourites
router.get("/favourites", authMiddleware, async (context) => {
  const path = context.request.url.searchParams.get("path");
  const response = await dbHandler.getFavourites(context.state.user.username, path);

  context.response.body = response;
});

router.post("/favourites", authMiddleware, async (context) => {
  const { path } = await context.request.body.json();

  if (!path) {
    context.response.body = { error: "All Fields are required" };
    return;
  }

  const favourite: Favourite = new Favourite(path, "", new Date(), context.state.user.username);

  await dbHandler.insertFavourite(favourite);

  context.response.status = 200;
});

app.use(router.routes());
app.use(router.allowedMethods());

const port = 8000;
console.log(`Server is running on http://localhost:${port}`);
await app.listen({ port });
