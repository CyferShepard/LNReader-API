import { Chapter } from "./chapter.ts";

export class ChapterWithContent extends Chapter {
  content: string;

  constructor(index: number, title: string, url: string, content: string) {
    super(index, title, url);
    this.content = content;
  }

  static override fromResult(data: any): ChapterWithContent {
    const baseChapter = Chapter.fromResult(data);
    return new ChapterWithContent(baseChapter.index, baseChapter.title, baseChapter.url, data.content);
  }

  override toJSON(): object {
    return {
      ...super.toJSON(),
      content: this.content,
    };
  }
}
