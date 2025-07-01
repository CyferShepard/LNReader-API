import { Chapter } from "./chapter.ts";
import { ChapterMeta } from "./chapter_meta.ts";
import { NovelMeta } from "./novel_meta.ts";

export class FavouriteWitChapterMeta extends NovelMeta {
  chapter: ChapterMeta;

  constructor(
    source: string,
    url: string,
    cover: string,
    title: string,
    summary: string,
    author: string,
    status: string,
    genres: string[],
    lastUpdate: string | null,
    additionalProps: Record<string, unknown>,
    chapter: ChapterMeta
  ) {
    super(source, url, cover, title, summary, author, status, genres, lastUpdate ?? "Unknown", additionalProps);
    this.chapter = chapter;
  }

  static override fromResult(data: any): FavouriteWitChapterMeta {
    return new FavouriteWitChapterMeta(
      data.source,
      data.url,
      data.cover,
      data.title,
      data.summary,
      data.author,
      data.status,
      data.genres,
      data.lastUpdate,
      data.additionalProps,

      ChapterMeta.fromJSON(JSON.parse(data.chapter))
    );
  }

  override toJSON(): object {
    return {
      source: this.source,
      url: this.url,
      cover: this.cover,
      title: this.title,
      summary: this.summary,
      author: this.author,
      status: this.status,
      genres: this.genres,
      lastUpdate: this.lastUpdate,
      additionalProps: this.additionalProps,
      chapter: this.chapter.toJSON(),
    };
  }
}
