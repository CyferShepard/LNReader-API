class PaginationWrapper<T> {
  results: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;

  constructor(results: T[], page: number, pageSize: number, totalCount: number, totalPages: number) {
    this.results = results;
    this.page = page;
    this.pageSize = pageSize;
    this.totalCount = totalCount;
    this.totalPages = totalPages;
  }
}
