import { Chapter } from "./chapters.ts";
import { NovelMeta } from "./novel_meta.ts";

export class History {
  username: string;
  source: string;
  path: string;
  last_read: Date;
  page: number;
  position: number;
  chapter: Chapter | null;
  novel: NovelMeta | null;

  constructor(
    username: string,
    source: string,
    path: string,
    last_read: Date,
    page: number,
    position: number,
    chapter: Chapter | null,
    novel: NovelMeta | null
  ) {
    this.username = username;
    this.source = source;
    this.path = path;
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
      data.path,
      new Date(data.last_read),
      data.page,
      data.position,
      data.chapter,
      data.novel
    );
  }

  toJSON(): object {
    return {
      username: this.username,
      source: this.source,
      path: this.path,
      last_read: this.last_read,
      page: this.page,
      position: this.position,
      chapter: this.chapter
        ? Chapter.fromResult(
            NovelMeta.fromResult(JSON.parse(this.novel as unknown as string)).name,
            JSON.parse(this.chapter as unknown as string)
          )
        : null,
      novel: this.novel ? NovelMeta.fromResult(JSON.parse(this.novel as unknown as string)) : null,
    };
  }
}
