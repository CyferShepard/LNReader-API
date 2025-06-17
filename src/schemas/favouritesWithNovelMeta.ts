import { NovelMeta } from "./novel_meta.ts";

export class FavouriteWithNovelMeta extends NovelMeta {
  date_added: string;

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
    lastUpdate: string | null
  ) {
    super(source, url, cover, title, summary, author, status, genres, lastUpdate ?? "Unknown");
    this.date_added = date_added;
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
      data.lastUpdate
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
    };
  }
}
