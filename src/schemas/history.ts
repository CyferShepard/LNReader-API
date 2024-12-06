export class History {
  path: string;
  last_read: Date;
  page: number;
  position: number;
  username: string;

  constructor(path: string, last_read: Date, page: number, position: number, username: string) {
    this.path = path;
    this.last_read = last_read;
    this.page = page;
    this.position = position;
    this.username = username;
  }

  static fromJSON(json: string): History {
    const data = JSON.parse(json);
    return new History(data.path, new Date(data.last_read), data.page, data.position, data.username);
  }

  toJSON(): string {
    return JSON.stringify({
      path: this.path,
      last_read: this.last_read.toISOString(),
      page: this.page,
      position: this.position,
      username: this.username,
    });
  }
}
