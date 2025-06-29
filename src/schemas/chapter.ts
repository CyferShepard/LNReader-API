export class Chapter {
  index: number;
  title: string;
  url: string;
  date_added: Date;

  constructor(index: number, title: string, url: string, date_added: Date) {
    this.index = index;
    this.title = title;
    this.url = url;
    this.date_added = date_added;
  }

  static fromResult(data: any): Chapter {
    return new Chapter(
      data["chapterIndex"] ?? data.index,
      data["title"] ?? data.title,
      data["url"] ?? data.url,
      data["date_added"] ? new Date(data["date_added"]) : new Date()
    );
  }

  static fromJSON(data: any): Chapter {
    return new Chapter(
      data["chapterIndex"] ?? data["index"],
      data["title"],
      data["url"],
      data["date_added"] ? new Date(data["date_added"]) : new Date()
    );
  }

  static fromJSONList(data: any[]): Chapter[] {
    return data.map((item) => Chapter.fromJSON(item));
  }

  toJSON(): object {
    return {
      index: this.index,
      title: this.title,
      url: this.url,
      date_added: this.date_added.toISOString(),
    };
  }
}
