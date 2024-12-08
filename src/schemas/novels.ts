import { Chapter } from "./chapters.ts";

export class Novel {
  source: string;
  name: string;
  path: string;
  cover: string;
  summary: string;
  chapters: Chapter[];

  constructor(source: string, name: string, path: string, cover: string, summary: string, chapters: Chapter[]) {
    this.source = source;
    this.name = name;
    this.path = path;
    this.cover = cover;
    this.summary = summary;
    this.chapters = chapters;
  }

  static fromResult(data: any): Novel {
    return new Novel(
      data.source,
      data.name,
      data.path,
      data.cover,
      data.summary,
      JSON.parse(data.chapters).map((chapter: any) => Chapter.fromResult(chapter))
    );
  }

  toJSON(): object {
    return {
      source: this.source,
      name: this.name,
      path: this.path,
      cover: this.cover,
      summary: this.summary,
      chapters: this.chapters.map((chapter: Chapter) => chapter.toJSON()),
    };
  }
}
