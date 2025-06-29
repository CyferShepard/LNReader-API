export class ImageCache {
  url: string;
  contentType: string; //
  data: Uint8Array;

  constructor(url: string, contentType: string, data: Uint8Array) {
    this.url = url;
    this.contentType = contentType; // Default to 'image/jpeg' if not provided
    this.data = data;
  }

  static fromResult(data: any): ImageCache {
    return new ImageCache(data.url, data.contentType, data.data);
  }

  static fromJSON(data: any): ImageCache {
    return new ImageCache(data.url, data.contentType, data.data);
  }

  toJSON(): object {
    return {
      url: this.url,
      contentType: this.contentType, // Include contentType in JSON output
      data: this.data,
    };
  }
}
