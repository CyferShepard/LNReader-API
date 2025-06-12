export class User {
  username: string;
  password: string | null;
  userlevel: number;

  constructor(username: string, password: string | null, userlevel: number = 1) {
    this.username = username;
    this.password = password;
    this.userlevel = userlevel;
  }

  static fromResult(data: any): User {
    return new User(data.username, data.password, data.userlevel);
  }

  toJSON(): object {
    return {
      username: this.username,
      password: this.password,
      userlevel: this.userlevel,
    };
  }
}
