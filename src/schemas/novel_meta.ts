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

  constructor(
    source: string,
    url: string,
    cover: string,
    title: string,
    summary: string,
    author: string,
    status: string,
    genres: string[],
    lastUpdate: string
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
  }

  static fromResult(data: any): NovelMeta {
    return new NovelMeta(
      data.source,
      data.url,
      data.cover,
      data.title,
      data.summary,
      data.author,
      data.status,
      data.genres,
      data.lastUpdate
    );
  }

  static fromJSON(data: any): NovelMeta {
    return new NovelMeta(
      data["source"],
      data["url"],
      data["cover"],
      data["title"],
      data["summary"],
      data["author"],
      data["status"],
      data["genres"] || [],
      data["lastUpdate"] || "Unknown"
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
    };
  }
}
