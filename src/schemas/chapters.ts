export class Chapter {
  name: string;
  path: string;
  content: string;

  constructor(name: string, path: string, content: string) {
    this.name = name;
    this.path = path;
    this.content = content;
  }

  static fromResult(data: any): Chapter {
    return new Chapter(data.name, data.path, data.content);
  }

  toJSON(): object {
    return {
      name: this.name,
      path: this.path,
      content: this.content,
    };
  }
}
