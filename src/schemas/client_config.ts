export class ClientConfig {
  client_version: string;
  client_type: string;

  constructor(client_version: string, client_type: string) {
    this.client_version = client_version;
    this.client_type = client_type;
  }

  static fromJSON(data: any): ClientConfig {
    return new ClientConfig(data.client_version, data.client_type);
  }

  static fromJSONList(data: any[]): ClientConfig[] {
    return data.map((item) => ClientConfig.fromJSON(item));
  }

  toJSON(): object {
    return {
      version: this.client_version,
      type: this.client_type,
    };
  }
}
