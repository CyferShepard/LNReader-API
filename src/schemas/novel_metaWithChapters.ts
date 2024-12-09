import { Chapter } from "./chapters.ts";
import { NovelMeta } from "./novel_meta.ts";

export class NovelMetaWithChapters extends NovelMeta {
  chapters: Chapter[];

  constructor(source: string, name: string, path: string, cover: string, summary: string, chapters: Chapter[]) {
    super(source, name, path, cover, summary);
    this.chapters = chapters;
  }

  static override fromResult(data: any): NovelMetaWithChapters {
    return new NovelMetaWithChapters(
      data.source,
      data.name,
      data.path,
      data.cover,
      data.summary,
      data.chapters.map((c: any) => Chapter.fromResult(c))
    );
  }

  override toJSON(): object {
    return {
      ...super.toJSON(),
      chapters: this.chapters.map((c) => c.toJSON()),
    };
  }
}
