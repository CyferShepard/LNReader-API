import { Chapter } from "./chapter.ts";
import { NovelMeta } from "./novel_meta.ts";

export class History {
  username: string;
  source: string;
  url: string;
  last_read: Date;
  page: number;
  position: number;
  chapter: Chapter | null;
  novel: NovelMeta | null;

  constructor(
    username: string,
    source: string,
    url: string,
    last_read: Date,
    page: number,
    position: number,
    chapter: Chapter | null,
    novel: NovelMeta | null
  ) {
    this.username = username;
    this.source = source;
    this.url = url;
    this.last_read = last_read;
    this.page = page;
    this.position = position;
    this.chapter = chapter;
    this.novel = novel;
  }

  static fromResult(data: any): History {
    return new History(
      data.username,
      data.source,
      data.url,
      new Date(data.last_read),
      data.page,
      data.position,
      Chapter.fromJSON(JSON.parse(data.chapter)),
      NovelMeta.fromJSON(JSON.parse(data.novel))
    );
  }

  toJSON(): object {
    return {
      username: this.username,
      source: this.source,
      url: this.url,
      last_read: this.last_read,
      page: this.page,
      position: this.position,
      chapter: this.chapter ? this.chapter.toJSON() : null,
      novel: this.novel ? this.novel.toJSON() : null,
    };
  }
}
