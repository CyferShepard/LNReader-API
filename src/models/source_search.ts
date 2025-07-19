export class SourceSearch {
  source: string;
  searchParams: string;
  results?: Record<string, unknown>;

  constructor(source: string, searchParams: string) {
    this.source = source;
    this.searchParams = searchParams;
  }

  static fromResult(data: Record<string, string>): SourceSearch {
    return new SourceSearch(data.source, data.searchParams);
  }

  static fromJSON(json: object): SourceSearch {
    if (typeof json !== "object" || json === null) {
      throw new Error("Invalid JSON object");
    }
    const { source, searchParams } = json as { source: string; searchParams: string };
    if (typeof source !== "string" || typeof searchParams !== "string") {
      throw new Error("Invalid properties in JSON object");
    }
    return new SourceSearch(source, searchParams);
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
      searchParams: this.searchParams,
      results: this.results,
    };
  }

  static toJSONList(list: SourceSearch[]): object[] {
    return list.map((item) => item.toJSON());
  }
}
