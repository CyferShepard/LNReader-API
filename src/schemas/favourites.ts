export class Favourite {
  username: string;
  source: string;
  path: string;
  date_added: Date;

  constructor(username: string, source: string, path: string, date_added: Date) {
    this.username = username;
    this.source = source;
    this.path = path;
    this.date_added = date_added;
  }

  static fromResult(data: any): Favourite {
    return new Favourite(data.username, data.source, data.path, new Date(data.date_added));
  }

  toJSON(): object {
    return {
      username: this.username,
      source: this.source,
      path: this.path,
      date_added: this.date_added,
    };
  }
}
