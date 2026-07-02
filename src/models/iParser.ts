import { Chapter } from "./Chapter.ts";
import { Chapters } from "./Chapters.ts";
import { Details } from "./Details.ts";
import { SearchResults } from "./SearchResults.ts";
import { SourceFilterField } from "./source_filter.ts";

export interface iParser {
  source: string;
  filters: SourceFilterField[];
  search(query: string, page?: number): Promise<SearchResults>;
  getLatest(page?: number): Promise<SearchResults>;
  getNovel(url: string): Promise<Details | null>;
  getChapters(url: string, page?: number, additionalProps?: Record<string, string>): Promise<Chapters>;
  getChapter(url: string, additionalProps?: Record<string, string>): Promise<Chapter | null>;
}

export abstract class ParserBase implements iParser {
  abstract source: string;
  abstract filters: SourceFilterField[];
  abstract search(query: string, page?: number): Promise<SearchResults>;
  abstract getLatest(page?: number): Promise<SearchResults>;
  abstract getNovel(url: string): Promise<Details | null>;
  abstract getChapters(url: string, page?: number, additionalProps?: Record<string, string>): Promise<Chapters>;
  abstract getChapter(url: string, additionalProps?: Record<string, string>): Promise<Chapter | null>;

  protected createFormData(data: Record<string, string | number | boolean | null | undefined>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        formData.set(key, String(value));
      }
    }
    return formData;
  }

  protected normalizeText(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  protected parseAdditionalProps(value?: Record<string, string>): string {
    if (!value || typeof value !== "object") {
      return "";
    }
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(value)) {
      params.append(key, val);
    }
    return "&" + params.toString();
  }

  public getSourceDetails(): { name: string; filters: SourceFilterField[] } {
    return {
      name: this.source,
      filters: this.filters,
    };
  }
}
