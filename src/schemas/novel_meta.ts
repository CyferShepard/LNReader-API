export class NovelMeta {
  source: string;
  name: string;
  path: string;
  cover: string;
  summary: string;

  constructor(source: string, name: string, path: string, cover: string, summary: string) {
    this.source = source;
    this.name = name;
    this.path = path;
    this.cover = cover;
    this.summary = summary;
  }

  static fromResult(data: any): NovelMeta {
    return new NovelMeta(data.source, data.name, data.path, data.cover, data.summary);
  }

  toJSON(): object {
    return {
      source: this.source,
      name: this.name,
      path: this.path,
      cover: this.cover,
      summary: this.summary,
    };
  }
}
