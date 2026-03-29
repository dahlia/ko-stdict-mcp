import type { FieldName } from "./types.ts";
import { DEFAULT_FIELDS, FIELD_NAMES } from "./types.ts";

const FIELD_NAME_SET = new Set<string>(FIELD_NAMES);

export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s\-\^]+/g, "");
}

export function decodeContentDispositionFilename(
  header: string | null,
): string | null {
  if (!header) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = /filename="?([^"]+)"?/i.exec(header);
  if (plainMatch) {
    return decodeURIComponent(plainMatch[1]);
  }

  return null;
}

export function extractSourceDate(filename: string | null): string | null {
  if (!filename) {
    return null;
  }
  const match = /_(\d{8})\.zip$/i.exec(filename);
  if (!match) {
    return null;
  }
  const [, yyyymmdd] = match;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${
    yyyymmdd.slice(6, 8)
  }`;
}

export function uniqueNonEmpty(
  values: Iterable<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}

export function pickFields(fields?: readonly string[] | null): FieldName[] {
  if (!fields || fields.length === 0) {
    return [...DEFAULT_FIELDS];
  }

  const selected = fields.filter((field): field is FieldName =>
    FIELD_NAME_SET.has(field)
  );
  return selected.length > 0 ? selected : [...DEFAULT_FIELDS];
}

export function ensure<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

export function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
