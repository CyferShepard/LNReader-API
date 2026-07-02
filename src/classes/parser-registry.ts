import { ParserBase } from "../models/iParser.ts";
import { SourceFilterField } from "../models/source_filter.ts";

type ParserConstructor = new () => ParserBase;
type ParserModule = {
  default?: ParserConstructor;
  Main?: ParserConstructor;
};

export type ParserMethod = "search" | "getNovel" | "getChapters" | "getChapter";

type ParserMethodArgs = {
  search: [query: string];
  getNovel: [url: string];
  getChapters: [url: string, additionalProps?: Record<string, string>];
  getChapter: [url: string, additionalProps?: Record<string, string>];
};

function isParserInstance(value: unknown): value is ParserBase {
  if (!value || typeof value !== "object") {
    return false;
  }

  const parser = value as Record<string, unknown>;
  return (
    typeof parser.source === "string" &&
    typeof parser.search === "function" &&
    typeof parser.getNovel === "function" &&
    typeof parser.getChapters === "function" &&
    typeof parser.getChapter === "function"
  );
}

export class ParserRegistry {
  private readonly parsers = new Map<string, ParserBase>();
  private loaded = false;

  constructor(private readonly pluginsDir: URL = new URL("../plugins/", import.meta.url)) {}

  private async *walkPluginFiles(dir: URL): AsyncGenerator<URL> {
    for await (const entry of Deno.readDir(dir)) {
      const entryUrl = new URL(entry.name, dir);

      if (entry.isDirectory) {
        yield* this.walkPluginFiles(new URL(`${entry.name}/`, dir));
        continue;
      }

      if (entry.isFile && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        yield entryUrl;
      }
    }
  }

  async loadParsers(forceReload = false): Promise<Map<string, ParserBase>> {
    if (this.loaded && !forceReload) {
      return this.parsers;
    }

    if (forceReload) {
      this.parsers.clear();
      this.loaded = false;
    }

    for await (const moduleUrl of this.walkPluginFiles(this.pluginsDir)) {
      const entryName = decodeURIComponent(moduleUrl.pathname.split("/").pop() ?? moduleUrl.href);

      try {
        const module = (await import(moduleUrl.href)) as ParserModule;
        const ParserClass = module.Main ?? module.default;

        if (!ParserClass) {
          continue;
        }

        const parser = new ParserClass();
        if (!isParserInstance(parser)) {
          continue;
        }

        const sourceKey = parser.source.trim().length > 0 ? parser.source.trim() : entryName.replace(/\.ts$/, "");

        this.parsers.set(sourceKey, parser);
      } catch (error) {
        console.error(`Failed to load parser module ${entryName}:`, error);
      }
    }

    this.loaded = true;
    return this.parsers;
  }

  listSources(): { name: string; filters: SourceFilterField[] }[] {
    return Array.from(this.parsers.values()).map((parser) => parser.getSourceDetails());
  }

  getParser(source: string): ParserBase | undefined {
    return this.parsers.get(source);
  }

  async getOrLoadParser(source: string): Promise<ParserBase | undefined> {
    if (!this.loaded) {
      await this.loadParsers();
    }
    return this.getParser(source);
  }

  async requireParser(source: string): Promise<ParserBase> {
    const parser = await this.getOrLoadParser(source);
    if (!parser) {
      const sources = this.listSources();
      throw new Error(`Parser '${source}' not found. Available sources: ${sources.length > 0 ? sources.join(", ") : "none"}`);
    }
    return parser;
  }

  async invoke<K extends ParserMethod>(
    source: string,
    method: K,
    ...args: ParserMethodArgs[K]
  ): Promise<Awaited<ReturnType<ParserBase[K]>>> {
    const parser = await this.requireParser(source);
    const parserMethod = parser[method] as (...methodArgs: unknown[]) => unknown;
    return (await parserMethod.apply(parser, args as unknown[])) as Awaited<ReturnType<ParserBase[K]>>;
  }
}

export const parserRegistry = new ParserRegistry();
