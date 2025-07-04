import { SourceFilterField } from "./source_filter.ts";

export class Source {
  name: string;
  filters: SourceFilterField[];

  constructor(name: string, filters: SourceFilterField[] = []) {
    this.name = name;
    this.filters = filters;
  }

  static fromJSON(data: any): Source {
    return new Source(
      data.name,
      data.filters.map((filter: any) => SourceFilterField.fromJSON(filter))
    );
  }

  toJSON(): object {
    return {
      name: this.name,
      filters: this.filters.map((filter) => filter.toJSON()),
    };
  }
}
