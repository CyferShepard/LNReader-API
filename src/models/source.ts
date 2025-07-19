import { SourceFilterField } from "./source_filter.ts";

interface SourceJSON {
  name: string;
  filters: (Record<string, unknown> | string)[];
}

export class Source {
  name: string;
  filters: SourceFilterField[];

  constructor(name: string, filters: SourceFilterField[] = []) {
    this.name = name;
    this.filters = filters;
  }

  static fromJSON(data: SourceJSON): Source {
    return new Source(
      data.name,
      data.filters.map((filter: Record<string, unknown> | string) => SourceFilterField.fromJSON(filter))
    );
  }

  toJSON(): object {
    return {
      name: this.name,
      filters: this.filters.map((filter) => filter.toJSON()),
    };
  }
}
