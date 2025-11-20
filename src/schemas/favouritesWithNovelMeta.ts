import { NovelMeta } from "./novel_meta.ts";

export class FavouriteWithNovelMeta extends NovelMeta {
  date_added: string;
  chapter_date_added: string;
  last_read: string;
  chapterCount: number;
  readCount: number;
  categories: string[];

  constructor(
    date_added: string,
    source: string,
    url: string,
    cover: string,
    title: string,
    summary: string,
    author: string,
    status: string,
    genres: string[],
    tags: string[],
    lastUpdate: string | null,
    additionalProps: Record<string, unknown>,
    chapterCount: number = 0,
    readCount: number = 0,
    categories: string[],
    chapter_date_added: string,
    last_read: string
  ) {
    super(source, url, cover, title, summary, author, status, genres, tags, lastUpdate ?? "Unknown", additionalProps);
    this.date_added = date_added;
    this.chapterCount = chapterCount;
    this.readCount = readCount;
    this.categories = categories;
    this.chapter_date_added = chapter_date_added;
    this.last_read = last_read;
  }

  static override fromResult(data: any): FavouriteWithNovelMeta {
    return new FavouriteWithNovelMeta(
      data.date_added,
      data.source,
      data.url,
      data.cover,
      data.title,
      data.summary,
      data.author,
      data.status,
      data.genres,
      data.tags,
      data.lastUpdate,
      JSON.parse(data.additionalProps),
      data.chapterCount ?? 0,
      data.readCount ?? 0,
      data.categories,
      data.chapter_date_added,
      data.last_read
    );
  }

  override toJSON(): object {
    return {
      date_added: this.date_added,
      source: this.source,
      url: this.url,
      cover: this.cover,
      title: this.title,
      summary: this.summary,
      author: this.author,
      status: this.status,
      genres: this.genres,
      tags: this.tags,
      lastUpdate: this.lastUpdate,
      additionalProps: this.additionalProps,
      chapterCount: this.chapterCount,
      readCount: this.readCount,
      categories: this.categories,
      chapter_date_added: this.chapter_date_added,
      last_read: this.last_read,
    };
  }
}
