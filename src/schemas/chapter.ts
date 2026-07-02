export class Chapter {
  index: number;
  title: string;
  url: string;
  date_added: Date;
  additionalProps: Record<string, unknown> = {};

  constructor(index: number, title: string, url: string, date_added: Date, additionalProps: Record<string, unknown> = {}) {
    this.index = index;
    this.title = title;
    this.url = url;
    this.date_added = date_added;
    this.additionalProps = additionalProps;
  }

  static fromResult(data: any): Chapter {
    const additionalProps = data.additionalProps || "{}";
    if (typeof additionalProps === "string") {
      try {
        data.additionalProps = JSON.parse(additionalProps);
      } catch (e) {
        console.warn("Failed to parse additionalProps as JSON:", e);
        data.additionalProps = {};
      }
    }
    return new Chapter(
      data["chapterIndex"] ?? data.index,
      data["title"] ?? data.title,
      data["url"] ?? data.url,
      data["date_added"] ? new Date(data["date_added"]) : new Date(),
      data.additionalProps || {},
    );
  }

  static fromJSON(data: any): Chapter {
    const additionalProps = data["additionalProps"] || "{}";
    if (typeof additionalProps === "string") {
      try {
        data["additionalProps"] = JSON.parse(additionalProps);
      } catch (e) {
        console.warn("Failed to parse additionalProps as JSON:", e);
        data["additionalProps"] = {};
      }
    }
    return new Chapter(
      data["chapterIndex"] ?? data["index"],
      data["title"],
      data["url"],
      data["date_added"] ? new Date(data["date_added"]) : new Date(),
      data["additionalProps"],
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
      additionalProps: this.additionalProps,
    };
  }
}
