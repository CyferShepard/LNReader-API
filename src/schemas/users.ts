export class User {
  username: string;
  password: string;
  userlevel: number;

  constructor(username: string, password: string, userlevel: number = 1) {
    this.username = username;
    this.password = password;
    this.userlevel = userlevel;
  }

  static fromJSON(json: string): User {
    const data = JSON.parse(json);
    return new User(data.username, data.password, data.userlevel);
  }

  toJSON(): string {
    return JSON.stringify({
      username: this.username,
      password: this.password,
      userlevel: this.userlevel,
    });
  }
}
