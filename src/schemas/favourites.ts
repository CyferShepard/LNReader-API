export class Favourite {
  path: string;
  cover: string;
  date_added: Date;
  username: string;

  constructor(path: string, cover: string, date_added: Date, username: string) {
    this.path = path;
    this.cover = cover;
    this.date_added = date_added;
    this.username = username;
  }

  static fromJSON(json: string): Favourite {
    const data = JSON.parse(json);
    return new Favourite(data.path, data.cover, new Date(data.date_added), data.username);
  }

  toJSON(): string {
    return JSON.stringify({
      path: this.path,
      cover: this.cover,
      date_added: this.date_added.toISOString(),
      username: this.username,
    });
  }
}
