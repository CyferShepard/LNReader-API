export class Novel {
  source: string;
  name: string;
  path: string;
  cover: string;
  summary: string;
  chapters: string[];

  constructor(source: string, name: string, path: string, cover: string, summary: string, chapters: string[]) {
    this.source = source;
    this.name = name;
    this.path = path;
    this.cover = cover;
    this.summary = summary;
    this.chapters = chapters;
  }

  static fromJSON(json: string): Novel {
    const data = JSON.parse(json);
    return new Novel(data.source, data.name, data.path, data.cover, data.summary, data.chapters);
  }

  toJSON(): string {
    return JSON.stringify({
      source: this.source,
      name: this.name,
      path: this.path,
      cover: this.cover,
      summary: this.summary,
      chapters: this.chapters,
    });
  }
}
