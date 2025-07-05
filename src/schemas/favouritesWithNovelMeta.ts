import { NovelMeta } from "./novel_meta.ts";

export class FavouriteWithNovelMeta extends NovelMeta {
  date_added: string;
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
    lastUpdate: string | null,
    additionalProps: Record<string, unknown>,
    chapterCount: number = 0,
    readCount: number = 0,
    categories: string[]
  ) {
    super(source, url, cover, title, summary, author, status, genres, lastUpdate ?? "Unknown", additionalProps);
    this.date_added = date_added;
    this.chapterCount = chapterCount;
    this.readCount = readCount;
    this.categories = categories;
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
      data.lastUpdate,
      JSON.parse(data.additionalProps),
      data.chapterCount ?? 0,
      data.readCount ?? 0,
      data.categories
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
      lastUpdate: this.lastUpdate,
      additionalProps: this.additionalProps,
      chapterCount: this.chapterCount,
      readCount: this.readCount,
      categories: this.categories,
    };
  }
}
