export class Chapter {
  name: string;
  path: string;
  content: string;

  constructor(name: string, path: string, content: string) {
    this.name = name;
    this.path = path;
    this.content = content;
  }

  static fromJSON(json: string): Chapter {
    const data = JSON.parse(json);
    return new Chapter(data.name, data.path, data.content);
  }

  toJSON(): string {
    return JSON.stringify({
      name: this.name,
      path: this.path,
      content: this.content,
    });
  }
}
