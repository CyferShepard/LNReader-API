export class Categorties {
  name: string;
  username: string;
  position: number;

  constructor(name: string, username: string, position: number = 0) {
    this.name = name;
    this.username = username;

    this.position = position;
  }

  static fromResult(data: any): Categorties {
    return new Categorties(data.name, data.username, data.position);
  }

  toJSON(): object {
    return {
      name: this.name,
      username: this.username,
      position: this.position,
    };
  }
}
