import { JSONUtils } from "../utils/json_utils.ts";

export class NovelMeta {
  source: string;
  url: string;
  fullUrl?: string; // Added to store the full URL
  cover: string;
  title: string;
  summary: string;
  author: string;
  status: string;
  genres: string[];
  tags: string[];
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
    tags: string[] = [],
    lastUpdate: string,
    additionalProps: Record<string, unknown> = {},
    fullUrl?: string
  ) {
    this.source = source;
    this.url = url;
    this.fullUrl = fullUrl; // Initialize fullUrl
    this.cover = cover;
    this.title = title;
    this.summary = summary;
    this.author = author;
    this.status = status;
    this.genres = genres;
    this.tags = tags;
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

    const tags = JSONUtils.tryParse(data.tags, []);
    return new NovelMeta(
      data.source,
      data.url,
      data.cover,
      data.title,
      data.summary ?? "No summary available",
      data.author ?? "Unknown",
      data.status ?? "Unknown",
      data.genres || [],
      tags,
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
      data["tags"] || [],
      data["lastUpdate"] || "Unknown",
      data["additionalProps"]
    );
  }

  toJSON(): object {
    return {
      source: this.source,
      url: this.url,
      fullUrl: this.fullUrl, // Include fullUrl in JSON output
      cover: this.cover,
      title: this.title,
      summary: this.summary,
      author: this.author,
      status: this.status,
      genres: this.genres,
      tags: this.tags,
      lastUpdate: this.lastUpdate,
      additionalProps: this.additionalProps,
    };
  }
}
