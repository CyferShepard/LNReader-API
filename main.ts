import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import PLUGINS from "./src/plugins/index.ts";
import { resolve } from "https://deno.land/std/path/mod.ts";

const sourceMapFilePath = resolve(Deno.cwd(), "sourceMap.json");

const app = new Application();
const router = new Router();
let sourceMap: { source: string; language: string; index: number }[] = [];

async function getSource(source: string) {
  if (sourceMap.length === 0) {
    const fileContent = await Deno.readTextFile(sourceMapFilePath);
    sourceMap = JSON.parse(fileContent) as { source: string; language: string; index: number }[];
  }

  return sourceMap.find((s) => s.source === source);
}

router.get("/", (context) => {
  context.response.body = "Hello, world!";
});

router.get("/sources", async (context) => {
  const language = context.request.url.searchParams.get("language");
  if (sourceMap.length === 0) {
    await getSource("");
  }

  context.response.body = sourceMap
    .filter((s) => s.language == language || !language)
    .map((s) => {
      return { source: s.source, language: s.language };
    });
});

router.post("/search", async (context) => {
  const { source, searchTerm, page = 1 } = await context.request.body.json();

  const findSourceIndex = await getSource(source);
  if (!findSourceIndex) {
    context.response.body = { error: "Source not found", "available sources": sourceMap.map((s) => s.source) };
    return;
  }

  const sourcePlugin = PLUGINS[findSourceIndex.index];

  console.log(page);

  const response = await sourcePlugin.searchNovels(searchTerm, page);

  console.log(searchTerm);
  context.response.body = response;
});

router.post("/popular", async (context) => {
  const { source, page = 1, showLatestNovels = true } = await context.request.body.json();
  const findSourceIndex = await getSource(source);

  if (!findSourceIndex) {
    context.response.body = { error: "Source not found", "available sources": sourceMap.map((s) => s.source) };
    return;
  }

  const sourcePlugin = PLUGINS[findSourceIndex.index];

  console.log(page);

  const response = await sourcePlugin.popularNovels(page, { showLatestNovels: showLatestNovels, filters: sourcePlugin.filters });

  context.response.body = response;
});

router.post("/novel", async (context) => {
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

router.post("/chapter", async (context) => {
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

app.use(router.routes());
app.use(router.allowedMethods());

const port = 8000;
console.log(`Server is running on http://localhost:${port}`);
await app.listen({ port });
