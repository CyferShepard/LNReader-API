import { Chapter } from "./chapters.ts";

export class ChapterWithContent extends Chapter {
  content: string;

  constructor(name: string, path: string, content: string) {
    super(name, path);
    this.content = content;
  }

  static override fromResult(data: any): ChapterWithContent {
    const baseChapter = Chapter.fromResult(data);
    return new ChapterWithContent(baseChapter.name, baseChapter.path, data.content);
  }

  override toJSON(): object {
    return {
      ...super.toJSON(),
      content: this.content,
    };
  }
}
