import { Chapter } from "./chapter.ts";

export class ChapterWithContent extends Chapter {
  content: string;

  constructor(index: number, title: string, url: string, content: string, date_added: Date) {
    super(index, title, url, date_added);
    this.content = content;
  }

  static override fromResult(data: any): ChapterWithContent {
    const baseChapter = Chapter.fromResult(data);
    return new ChapterWithContent(baseChapter.index, baseChapter.title, baseChapter.url, data.content, data.date_added);
  }

  override toJSON(): object {
    return {
      ...super.toJSON(),
      content: this.content,
    };
  }
}
