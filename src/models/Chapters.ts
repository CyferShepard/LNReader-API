export class Chapters {
  chapters: ChapterListItem[];
  currentPage: number;
  lastPage: number;

  constructor(chapters: ChapterListItem[] = [], currentPage: number = 0, lastPage: number = 0) {
    this.chapters = chapters;
    this.currentPage = currentPage;
    this.lastPage = lastPage;
  }

  toJSON(): object {
    return {
      chapters: this.chapters.map((chapter) => chapter.toJSON()),
      currentPage: this.currentPage,
      lastPage: this.lastPage,
    };
  }

  static fromJSON(json: any[]): Chapters {
    const chapters = (Array.isArray(json) ? json : [])
      .map((e) => {
        try {
          return ChapterListItem.fromJSON(e as Record<string, unknown>);
        } catch {
          return new ChapterListItem("", "", 0, "Error parsing chapter", "", "");
        }
      })
      .filter((c) => c.url.length > 0);

    return new Chapters(chapters);
  }
}

export class ChapterListItem {
  source: string;
  url: string;
  index: number;
  title: string;
  date: string;
  novelUrl: string;

  constructor(source: string, url: string, index: number = 0, title: string, date: string, novelUrl: string) {
    this.source = source;
    this.url = url;
    this.index = index;
    this.title = title;
    this.date = date;
    this.novelUrl = novelUrl;
  }

  toJSON(): object {
    return {
      source: this.source,
      url: this.url,
      index: this.index,
      title: this.title,
      date: this.date,
      novelUrl: this.novelUrl,
    };
  }

  static toJSONList(items: ChapterListItem[]): object[] {
    return items.map((item) => item.toJSON());
  }

  static fromJSON(json: Record<string, unknown>): ChapterListItem {
    return new ChapterListItem(
      typeof json.source === "string" ? json.source : "",
      typeof json.url === "string" ? json.url : "",
      typeof json.index === "number" ? json.index : 0,
      typeof json.title === "string" ? json.title : "",
      typeof json.date === "string" ? json.date : "",
      typeof json.novelUrl === "string" ? json.novelUrl : "",
    );
  }
}
