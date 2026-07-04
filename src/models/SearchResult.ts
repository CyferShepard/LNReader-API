export class SearchResult {
  url: string;
  title: string;
  summary: string;
  cover: string;
  genres: string[];
  chapterCount: number | null;
  source: string;
  additionalProps: Record<string, string>;

  constructor(
    url: string,
    title: string,
    summary: string,
    cover: string,
    genres: string[],
    chapterCount: number | null,
    source: string,
    additionalProps: Record<string, string> = {},
  ) {
    this.url = url;
    this.title = title;
    this.summary = summary;
    this.cover = cover;
    this.genres = genres;
    this.source = source;
    this.chapterCount = chapterCount;
    this.additionalProps = additionalProps;
  }

  static fromJSON(data: any): SearchResult {
    return new SearchResult(
      data.url,
      data.title,
      data.summary,
      data.cover,
      data.genres || [],
      data.chapterCount || null,
      data.source || "",
      data.additionalProps || {},
    );
  }

  static fromJSONList(jsonList: Array<object>): SearchResult[] {
    if (!Array.isArray(jsonList)) {
      throw new Error("Invalid JSON list");
    }
    return jsonList.map((json) => SearchResult.fromJSON(json));
  }

  toJSON(): object {
    return {
      url: this.url,
      title: this.title,
      summary: this.summary,
      cover: this.cover,
      genres: this.genres,
      chapterCount: this.chapterCount,
      source: this.source,
      additionalProps: this.additionalProps,
    };
  }
}
