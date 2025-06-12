export class NovelMeta {
  source: string;
  url: string;
  cover: string;
  title: string;
  summary: string;
  author: string;
  status: string;
  genres: string[];

  constructor(
    source: string,
    url: string,
    cover: string,
    title: string,
    summary: string,
    author: string,
    status: string,
    genres: string[]
  ) {
    this.source = source;
    this.url = url;
    this.cover = cover;
    this.title = title;
    this.summary = summary;
    this.author = author;
    this.status = status;
    this.genres = genres;
  }

  static fromResult(data: any): NovelMeta {
    return new NovelMeta(data.source, data.url, data.cover, data.title, data.summary, data.author, data.status, data.genres);
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
      data["genres"] || []
    );
  }

  toJSON(): object {
    return {
      source: this.source,
      url: this.url,
      cover: this.cover,
      title: this.title,
      summary: this.summary,
      arguments: this.author,
      status: this.status,
      genres: this.genres,
    };
  }
}
