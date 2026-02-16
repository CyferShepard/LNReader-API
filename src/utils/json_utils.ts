export class JSONUtils {
  static tryParse<T>(jsonString: string, defaultValue: T): T {
    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return defaultValue;
    }
  }
}
