export class ChapterUrlPagination {
  url: string;
  additionalProps: Record<string, unknown>;

  constructor(url: string, additionalProps?: Record<string, unknown>) {
    this.url = url;
    this.additionalProps = additionalProps || {};
  }

  toJSON(): object {
    return {
      url: this.url,
      additionalProps: this.additionalProps,
    };
  }

  static fromJSON(json: Record<string, unknown>): ChapterUrlPagination {
    return new ChapterUrlPagination(
      typeof json.url === "string" ? json.url : "",
      typeof json.additionalProps === "object" && json.additionalProps !== null
        ? (json.additionalProps as Record<string, unknown>)
        : {},
    );
  }
}

export class Chapter {
  source: string;
  novelTitle: string;
  novelUrl: string;
  title: string;
  content: string;
  previousPage?: ChapterUrlPagination;
  nextPage?: ChapterUrlPagination;
  url?: string;
  fullUrl?: string;

  constructor(
    source: string,
    novelTitle: string,
    novelUrl: string,
    title: string,
    content: string,
    previousPage?: ChapterUrlPagination,
    nextPage?: ChapterUrlPagination,
    url?: string,
    fullUrl?: string,
  ) {
    this.source = source;
    this.novelTitle = novelTitle;
    this.novelUrl = novelUrl;
    this.title = title;
    this.content = content;
    this.previousPage = previousPage;
    this.nextPage = nextPage;
    this.url = url;
    this.fullUrl = fullUrl;
  }

  toJSON(): object {
    return {
      source: this.source,
      novelTitle: this.novelTitle,
      novelUrl: this.novelUrl,
      title: this.title,
      content: this.content,
      previousPage: this.previousPage,
      nextPage: this.nextPage,
      url: this.url,
      fullUrl: this.fullUrl,
    };
  }

  static fromJSON(json: Record<string, unknown>): Chapter {
    let content = "";

    if (typeof json.content === "string") {
      content = json.content;
    } else if (Array.isArray(json.content)) {
      content = json.content.join("\n");
    }

    return new Chapter(
      typeof json.source === "string" ? json.source : "",
      typeof json.novelTitle === "string" ? json.novelTitle : "",
      typeof json.novelUrl === "string" ? json.novelUrl : "",
      typeof json.title === "string" ? json.title : "",
      content,
      typeof json.previousPage === "object" && json.previousPage !== null
        ? ChapterUrlPagination.fromJSON(json.previousPage as Record<string, unknown>)
        : undefined,
      typeof json.nextPage === "object" && json.nextPage !== null
        ? ChapterUrlPagination.fromJSON(json.nextPage as Record<string, unknown>)
        : undefined,
      typeof json.url === "string" ? json.url : undefined,
      typeof json.fullUrl === "string" ? json.fullUrl : undefined,
    );
  }

  get props(): Array<string | undefined> {
    return [
      this.source,
      this.novelTitle,
      this.novelUrl,
      this.title,
      this.content,
      this.previousPage?.url,
      this.nextPage?.url,
      this.url,
    ];
  }
}
