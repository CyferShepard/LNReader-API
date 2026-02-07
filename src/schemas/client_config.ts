export class ClientConfig {
  client_version: string;
  client_type: string;
  update_url?: string;

  constructor(client_version: string, client_type: string, update_url?: string) {
    this.client_version = client_version;
    this.client_type = client_type;
    this.update_url = update_url;
  }

  static fromJSON(data: any): ClientConfig {
    return new ClientConfig(data.client_version, data.client_type, data.update_url);
  }

  static fromJSONList(data: any[]): ClientConfig[] {
    return data.map((item) => ClientConfig.fromJSON(item));
  }

  toJSON(): object {
    const obj = {
      version: this.client_version,
      type: this.client_type,
    };
    if (this.update_url) {
      obj["url"] = this.update_url;
    }
    return obj;
  }
}
