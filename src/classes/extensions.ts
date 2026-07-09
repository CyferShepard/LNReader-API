import { QueryModel } from "../models/query_model.ts";
import { Database } from "jsr:@db/sqlite@0.13";

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

  interface FormData {
    replaceKeys(values: Record<string, unknown>): FormData;
  }

  interface Database {
    paginatedQuery(query: QueryModel, params: Record<string, unknown>, page: number, pageSize: number): Record<string, unknown>[];
    paginatedQueryWithCount(
      query: QueryModel,
      params: Record<string, unknown>,
      page: number,
      pageSize: number,
    ): { results: Record<string, unknown>[]; page: number; pageSize: number; totalCount: number; totalPages: number };
  }

  interface Object {
    jsonOrEmpty(): Promise<any | null>;
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

FormData.prototype.replaceKeys = function (values: Record<string, unknown>): FormData {
  const newFormData = new FormData();
  for (const [key, value] of this.entries()) {
    if (typeof value === "string") {
      newFormData.set(key, value.replaceKeys(values));
    } else {
      newFormData.set(key, value);
    }
  }
  return newFormData;
};

Database.prototype.paginatedQuery = function (
  query: QueryModel,
  params: Record<string, unknown>,
  page: number,
  pageSize: number,
): Record<string, unknown>[] {
  const offset = (page - 1) * pageSize;
  const paginatedQuery = `${query.query} LIMIT ${pageSize} OFFSET ${offset}`;
  const stmt = this.prepare(paginatedQuery);
  return stmt.all(params);
};

Database.prototype.paginatedQueryWithCount = function (
  query: QueryModel,
  params: Record<string, unknown>,
  page: number,
  pageSize: number,
): { results: Record<string, unknown>[]; page: number; pageSize: number; totalCount: number; totalPages: number } {
  const offset = (page - 1) * pageSize;
  const paginatedQuery = `${query.query} LIMIT ${pageSize} OFFSET ${offset}`;
  const stmt = this.prepare(paginatedQuery);
  const results = stmt.all(params);
  const countQuery = `SELECT COUNT(*) as COUNT FROM (${query.query})`;
  const countStmt = this.prepare(countQuery);
  const countResult = countStmt.get(params);
  const totalCount = countResult ? Number(countResult.COUNT) : 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return { results, page, pageSize, totalCount, totalPages };
};

Object.prototype.jsonOrEmpty = async function (this: any): Promise<any | null> {
  try {
    return await this.json();
  } catch {
    return {};
  }
};
