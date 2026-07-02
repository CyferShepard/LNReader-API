interface ChapterMetaData {
  source: string;
  chapterIndex: number;
  url: string;
  title: string;
  novelUrl: string;
  date_added: string; // or Date if you expect a Date object
  additionalProps: Record<string, unknown>;
}

export class ChapterMeta {
  source: string;
  chapterIndex: number;
  url: string;
  title: string;
  novelUrl: string;
  dateAdded: Date;
  additionalProps: Record<string, unknown> = {};

  constructor(
    source: string,
    chapterIndex: number,
    url: string,
    title: string,
    novelUrl: string,
    dateAdded: Date,
    additionalProps: Record<string, unknown> = {},
  ) {
    this.source = source;
    this.chapterIndex = chapterIndex;
    this.url = url;
    this.title = title;
    this.novelUrl = novelUrl;
    this.dateAdded = dateAdded;
    this.additionalProps = additionalProps;
  }

  static fromResult(data: any): ChapterMeta {
    const additionalProps = data.additionalProps || {};
    if (additionalProps && typeof additionalProps === "string") {
      try {
        data.additionalProps = JSON.parse(additionalProps);
      } catch (e) {
        console.warn("Failed to parse additionalProps as JSON:", e);
        data.additionalProps = {};
      }
    }
    return new ChapterMeta(
      data.source,
      data.chapterIndex,
      data.url,
      data.title,
      data.novelUrl,
      new Date(data.date_added),
      data.additionalProps,
    );
  }

  static fromJSON(data: any): ChapterMeta {
    const additionalProps = data.additionalProps;
    if (additionalProps && typeof additionalProps === "string") {
      try {
        data.additionalProps = JSON.parse(additionalProps);
      } catch (e) {
        console.warn("Failed to parse additionalProps as JSON:", e);
        data.additionalProps = {};
      }
    }

    let date = data.date_added ?? data.date;
    if (!date || date == "") {
      date = new Date().toISOString(); // Default to current date if not provided
    }

    return new ChapterMeta(
      data.source,
      data.chapterIndex ?? data.index,
      data.url,
      data.title,
      data.novelUrl,
      new Date(date), // Ensure date is parsed correctly
      data.additionalProps,
    );
  }

  static fromJSONList(data: any[]): ChapterMeta[] {
    return data.map((item) => ChapterMeta.fromJSON(item));
  }

  toJSON(): object {
    return {
      source: this.source,
      index: this.chapterIndex,
      url: this.url,
      title: this.title,
      novelUrl: this.novelUrl,
      date_added: this.dateAdded.toISOString(), // Convert to ISO string for JSON serialization
      additionalProps: this.additionalProps,
    };
  }
}
