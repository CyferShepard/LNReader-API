import { NovelMeta } from "./novel_meta.ts";

export class FavouriteWithNovelMeta extends NovelMeta {
  date_added: string;
  chapterCount: number;
  readCount: number;

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
    chapterCount: number = 0,
    readCount: number = 0
  ) {
    super(source, url, cover, title, summary, author, status, genres, lastUpdate ?? "Unknown");
    this.date_added = date_added;
    this.chapterCount = chapterCount;
    this.readCount = readCount;
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
      data.chapterCount ?? 0,
      data.readCount ?? 0
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
      chapterCount: this.chapterCount,
      readCount: this.readCount,
    };
  }
}
