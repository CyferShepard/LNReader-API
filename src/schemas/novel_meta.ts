export class NovelMeta {
  source: string;
  url: string;
  cover: string;
  title: string;
  summary: string;
  author: string;
  status: string;
  genres: string[];
  lastUpdate: string;
  additionalProps: Record<string, unknown> = {};

  constructor(
    source: string,
    url: string,
    cover: string,
    title: string,
    summary: string,
    author: string,
    status: string,
    genres: string[],
    lastUpdate: string,
    additionalProps: Record<string, unknown> = {}
  ) {
    this.source = source;
    this.url = url;
    this.cover = cover;
    this.title = title;
    this.summary = summary;
    this.author = author;
    this.status = status;
    this.genres = genres;
    this.lastUpdate = lastUpdate || "Unknown";
    this.additionalProps = additionalProps;
  }

  static fromResult(data: any): NovelMeta {
    const additionalProps = data.additionalProps || "{}";
    if (typeof additionalProps === "string") {
      try {
        data.additionalProps = JSON.parse(additionalProps);
      } catch (e) {
        console.warn("Failed to parse additionalProps as JSON:", e);
        data.additionalProps = {};
      }
    }
    return new NovelMeta(
      data.source,
      data.url,
      data.cover,
      data.title,
      data.summary ?? "No summary available",
      data.author ?? "Unknown",
      data.status ?? "Unknown",
      data.genres || [],
      data.lastUpdate || "Unknown",
      data.additionalProps || {}
    );
  }

  static fromJSON(data: any): NovelMeta {
    const additionalProps = data["additionalProps"] || "{}";
    if (typeof additionalProps === "string") {
      try {
        data["additionalProps"] = JSON.parse(additionalProps);
      } catch (e) {
        console.warn("Failed to parse additionalProps as JSON:", e);
        data["additionalProps"] = {};
      }
    }

    return new NovelMeta(
      data["source"],
      data["url"],
      data["cover"],
      data["title"],
      data["summary"] || "No summary available",
      data["author"] || "Unknown",
      data["status"] || "Unknown",
      data["genres"] || [],
      data["lastUpdate"] || "Unknown",
      data["additionalProps"]
    );
  }

  toJSON(): object {
    return {
      source: this.source,
      url: this.url,
      cover: this.cover,
      title: this.title,
      summary: this.summary,
      author: this.author,
      status: this.status,
      genres: this.genres,
      lastUpdate: this.lastUpdate,
      additionalProps: this.additionalProps,
    };
  }
}
