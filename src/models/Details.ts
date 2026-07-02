export class Details {
  source: string;
  url?: string;
  fullUrl?: string;
  cover?: string;
  title: string;
  summary: string;
  tags: string[];
  author: string;
  status: string;
  genres: string[];
  chapters: string;
  lastUpdate: string;
  additionalProps: Record<string, string>;
  categories: string[];

  constructor(
    source: string,
    title: string,
    summary: string,
    tags: string[],
    author: string,
    status: string,
    genres: string[],
    chapters: string,
    lastUpdate: string,
    additionalProps: Record<string, string> = {},
    categories: string[] = [],
    cover?: string,
    url?: string,
    fullUrl?: string,
  ) {
    this.source = source;
    this.title = title;
    this.summary = summary;
    this.tags = tags;
    this.author = author;
    this.status = status;
    this.genres = genres;
    this.chapters = chapters;
    this.lastUpdate = lastUpdate;
    this.additionalProps = additionalProps;
    this.categories = categories;
    this.cover = cover;
    this.url = url;
    this.fullUrl = fullUrl;
  }

  static fromJSON(data: any): Details {
    return new Details(
      data.source,
      data.title,
      data.summary,
      data.tags || [],
      data.author,
      data.status,
      data.genres || [],
      data.chapters,
      data.lastUpdate,
      data.additionalProps || {},
      data.categories || [],
      data.cover,
      data.url,
      data.fullUrl,
    );
  }

  toJSON(): object {
    return {
      source: this.source,
      title: this.title,
      summary: this.summary,
      tags: this.tags,
      author: this.author,
      status: this.status,
      genres: this.genres,
      chapters: this.chapters,
      lastUpdate: this.lastUpdate,
      additionalProps: this.additionalProps,
      categories: this.categories,
      cover: this.cover,
      url: this.url,
      fullUrl: this.fullUrl,
    };
  }
}
