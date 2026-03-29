import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import type { ResolvedPaths, ServerOptions } from "./types.ts";

export const PACKAGE_NAME = "ko-stdict-mcp";
export const PACKAGE_VERSION = "0.1.0";
export const SCHEMA_VERSION = 2;
export const DEFAULT_DOWNLOAD_URL =
  "https://stdict.korean.go.kr/common/download.do";
export const DEFAULT_JSON_LINK_KEY = "1538740";
export const DEFAULT_USER_AGENT =
  "ko-stdict-mcp/0.1.0 (+https://jsr.io/@hongminhee/ko-stdict-mcp)";
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function resolvePaths(options: ServerOptions = {}): ResolvedPaths {
  const rootDir = options.dataDir ?? resolveDefaultDataDir();
  const downloadsDir = join(rootDir, "downloads");
  const dbDir = join(rootDir, "db");

  return {
    rootDir,
    downloadsDir,
    dbDir,
    statePath: join(rootDir, "state.json"),
    dbPath: join(dbDir, "stdict.sqlite"),
    stagingDbPath: join(dbDir, "stdict.sqlite.next"),
  };
}

export async function ensurePaths(paths: ResolvedPaths): Promise<void> {
  await ensureDir(paths.rootDir);
  await ensureDir(paths.downloadsDir);
  await ensureDir(paths.dbDir);
}

function resolveDefaultDataDir(): string {
  const explicit = Deno.env.get("KO_STDICT_DATA_DIR");
  if (explicit) {
    return explicit;
  }

  const xdg = Deno.env.get("XDG_DATA_HOME");
  if (xdg) {
    return join(xdg, PACKAGE_NAME);
  }

  const home = Deno.env.get("HOME");
  if (home) {
    return join(home, ".local", "share", PACKAGE_NAME);
  }

  return join(Deno.cwd(), "data");
}
