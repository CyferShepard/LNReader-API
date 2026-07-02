import { SearchResults } from "./SearchResults.ts";

export class SourceSearch {
  source: string;
  query: string;
  searchResult?: SearchResults;

  constructor(source: string, query: string) {
    this.source = source;
    this.query = query;
  }

  static fromResult(data: Record<string, string>): SourceSearch {
    return new SourceSearch(data.source, data.query);
  }

  static fromJSON(json: object): SourceSearch {
    if (typeof json !== "object" || json === null) {
      throw new Error("Invalid JSON object");
    }
    const { source, query } = json as { source: string; query: string };
    if (typeof source !== "string" || typeof query !== "string") {
      throw new Error("Invalid properties in JSON object");
    }
    return new SourceSearch(source, query);
  }

  static fromJsonList(jsonList: Array<object>): SourceSearch[] {
    if (!Array.isArray(jsonList)) {
      throw new Error("Invalid JSON list");
    }
    return jsonList.map((json) => SourceSearch.fromJSON(json));
  }

  toJSON(): object {
    return {
      source: this.source,
      query: this.query,
      searchResult: this.searchResult,
    };
  }

  static toJSONList(list: SourceSearch[]): object[] {
    return list.map((item) => item.toJSON());
  }
}
