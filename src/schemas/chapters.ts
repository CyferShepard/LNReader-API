export class Chapter {
  name: string;
  path: string;

  constructor(name: string, path: string) {
    this.name = name;
    this.path = path;
  }

  static fromResult(data: any): Chapter {
    return new Chapter(data.name, data.path);
  }

  toJSON(): object {
    return {
      name: this.name,
      path: this.path,
    };
  }
}
