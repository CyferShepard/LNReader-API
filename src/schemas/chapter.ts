export class Chapter {
  index: number;
  title: string;
  url: string;

  constructor(index: number, title: string, url: string) {
    this.index = index;
    this.title = title;
    this.url = url;
  }

  static fromResult(data: any): Chapter {
    return new Chapter(data["chapterIndex"] ?? data.index, data["title"] ?? data.title, data["url"] ?? data.url);
  }

  static fromJSON(data: any): Chapter {
    return new Chapter(data["chapterIndex"] ?? data["index"], data["title"], data["url"]);
  }

  toJSON(): object {
    return {
      index: this.index,
      title: this.title,
      url: this.url,
    };
  }
}
