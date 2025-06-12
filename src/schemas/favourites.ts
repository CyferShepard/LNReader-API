export class Favourite {
  username: string;
  source: string;
  url: string;
  date_added: Date;

  constructor(username: string, source: string, url: string, date_added: Date) {
    this.username = username;
    this.source = source;
    this.url = url;
    this.date_added = date_added;
  }

  static fromResult(data: any): Favourite {
    return new Favourite(data.username, data.source, data.url, new Date(data.date_added));
  }

  toJSON(): object {
    return {
      username: this.username,
      source: this.source,
      url: this.url,
      date_added: this.date_added,
    };
  }
}
