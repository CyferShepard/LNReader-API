interface ChapterMetaData {
  source: string;
  chapterIndex: number;
  url: string;
  title: string;
  novelUrl: string;
  date_added: string; // or Date if you expect a Date object
}

export class ChapterMeta {
  source: string;
  chapterIndex: number;
  url: string;
  title: string;
  novelUrl: string;
  dateAdded: Date;

  constructor(source: string, chapterIndex: number, url: string, title: string, novelUrl: string, dateAdded: Date) {
    this.source = source;
    this.chapterIndex = chapterIndex;
    this.url = url;
    this.title = title;
    this.novelUrl = novelUrl;
    this.dateAdded = dateAdded;
  }

  static fromResult(data: ChapterMetaData): ChapterMeta {
    return new ChapterMeta(data.source, data.chapterIndex, data.url, data.title, data.novelUrl, new Date(data.date_added));
  }

  static fromJSON(data: ChapterMetaData): ChapterMeta {
    return new ChapterMeta(
      data.source,
      data.chapterIndex,
      data.url,
      data.title,
      data.novelUrl,
      new Date(data.date_added) // Ensure date is parsed correctly
    );
  }

  toJSON(): object {
    return {
      source: this.source,
      chapterIndex: this.chapterIndex,
      url: this.url,
      title: this.title,
      novelUrl: this.novelUrl,
      dateAdded: this.dateAdded.toISOString(), // Convert to ISO string for JSON serialization
    };
  }
}
