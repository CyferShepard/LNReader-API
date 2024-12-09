export class History {
  username: string;
  source: string;
  path: string;
  last_read: Date;
  page: number;
  position: number;

  constructor(username: string, source: string, path: string, last_read: Date, page: number, position: number) {
    this.username = username;
    this.source = source;
    this.path = path;
    this.last_read = last_read;
    this.page = page;
    this.position = position;
  }

  static fromResult(data: any): History {
    return new History(data.username, data.source, data.path, new Date(data.last_read), data.page, data.position);
  }

  toJSON(): object {
    return {
      username: this.username,
      source: this.source,
      path: this.path,
      last_read: this.last_read,
      page: this.page,
      position: this.position,
    };
  }
}
