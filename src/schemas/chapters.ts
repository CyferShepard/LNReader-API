import { parseChapterNumber } from "../utils/parseChapterNumber.ts";

export class Chapter {
  chapter_index: number;
  name: string;
  path: string;

  constructor(chapter_index: number, name: string, path: string) {
    this.chapter_index = chapter_index;
    this.name = name;
    this.path = path;
  }

  static fromResult(novelName: string, data: any): Chapter {
    return new Chapter(
      parseChapterNumber(novelName, data["name"] ?? data.name),
      data["name"] ?? data.name,
      data["path"] ?? data.path
    );
  }

  static fromJSON(novelName: string, data: any): Chapter {
    return new Chapter(parseChapterNumber(novelName, data["name"]), data["name"], data["path"]);
  }

  toJSON(): object {
    return {
      chapter_index: this.chapter_index,
      name: this.name,
      path: this.path,
    };
  }
}
