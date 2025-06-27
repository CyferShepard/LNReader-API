// Extend the Array prototype
declare global {
  interface Array<T> {
    firstOrDefault(defaultValue: T): T;
    firstOrNull(): T | null;
    findOrDefault(predicate: (value: T) => boolean, defaultValue: T): T;
    findOrNull(predicate: (value: T) => boolean): T | null;
  }
  interface String {
    replaceKeys(values: Record<string, unknown>): string;
  }
}

// Implementation of firstOrDefault
Array.prototype.firstOrDefault = function <T>(defaultValue: T): T {
  return this.length > 0 ? this[0] : defaultValue;
};

// Implementation of firstOrNull
Array.prototype.firstOrNull = function <T>(): T | null {
  return this.length > 0 ? this[0] : null;
};

Array.prototype.findOrDefault = function <T>(predicate: (value: T) => boolean, defaultValue: T): T {
  for (const item of this) {
    if (predicate(item)) {
      return item;
    }
  }
  return defaultValue;
};

Array.prototype.findOrNull = function <T>(predicate: (value: T) => boolean): T | null {
  for (const item of this) {
    if (predicate(item)) {
      return item;
    }
  }
  return null;
};

String.prototype.replaceKeys = function (values: Record<string, unknown>): string {
  return this.replace(/\$\{(\w+)\}/g, (_, key) => (values[key] !== undefined ? String(values[key]) : ""));
};
