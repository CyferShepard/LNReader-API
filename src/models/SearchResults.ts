import { SearchResult } from "./SearchResult.ts";

export class SearchResults {
  results: SearchResult[];
  currentPage: number | null;
  lastPage: number | null;

  constructor(results: SearchResult[], currentPage: number | null = 1, lastPage: number | null = 1) {
    this.results = results;
    this.currentPage = currentPage;
    this.lastPage = lastPage;
  }

  static fromJSON(data: any): SearchResults {
    const results = SearchResult.fromJSONList(data.results);
    return new SearchResults(results, data.currentPage || 1, data.lastPage || 1);
  }

  toJSON(): object {
    return {
      results: this.results.map((result) => result.toJSON()),
      currentPage: this.currentPage,
      lastPage: this.lastPage,
    };
  }
}
