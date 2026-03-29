import { exists } from "@std/fs";
import {
  DEFAULT_DOWNLOAD_URL,
  DEFAULT_JSON_LINK_KEY,
  DEFAULT_USER_AGENT,
  ensurePaths,
  resolvePaths,
  SCHEMA_VERSION,
} from "./config.ts";
import { appendItemToBatch, createEmptyBatch } from "./import/parse.ts";
import {
  createSchema,
  importBatch,
  openDatabase,
  readMetadata,
  replaceDatabase,
  type SqliteDatabase,
  writeMetadata,
} from "./import/sqlite.ts";
import { ensureDownload, readState, writeState } from "./source/download.ts";
import { iterateDumpItems } from "./source/unpack.ts";
import type {
  DictionaryStatus,
  ImportSummary,
  ResolvedPaths,
  ServerOptions,
  StateFile,
} from "./types.ts";
import { getDictionaryStatus } from "./query/search.ts";

const BATCH_SIZE = 500;

export class DictionaryService {
  readonly options: {
    dataDir?: string;
    downloadUrl: string;
    jsonLinkKey: string;
    userAgent: string;
  };
  readonly paths: ResolvedPaths;
  #db: SqliteDatabase | null = null;

  constructor(options: ServerOptions = {}) {
    this.options = {
      dataDir: options.dataDir ?? Deno.env.get("KO_STDICT_DATA_DIR") ??
        undefined,
      downloadUrl: options.downloadUrl ??
        Deno.env.get("KO_STDICT_DOWNLOAD_URL") ??
        DEFAULT_DOWNLOAD_URL,
      jsonLinkKey: options.jsonLinkKey ??
        Deno.env.get("KO_STDICT_JSON_LINK_KEY") ??
        DEFAULT_JSON_LINK_KEY,
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    };
    this.paths = resolvePaths(this.options);
  }

  get db(): SqliteDatabase {
    if (!this.#db) {
      throw new Error("Dictionary database is not initialized.");
    }
    return this.#db;
  }

  async initialize(): Promise<DictionaryStatus> {
    await ensurePaths(this.paths);

    const state = await readState(this.paths.statePath);
    const zipInfo = await ensureDownload({
      force: false,
      paths: this.paths,
      downloadUrl: this.options.downloadUrl,
      jsonLinkKey: this.options.jsonLinkKey,
      userAgent: this.options.userAgent,
    });

    const needsImport = !(await exists(this.paths.dbPath)) ||
      !this.#hasCurrentSchema();
    if (needsImport) {
      await this.#rebuildFromZip(
        zipInfo.zipPath,
        zipInfo.sourceFilename,
        zipInfo.sourceDate,
      );
    }

    if (!this.#db) {
      this.#db = openDatabase(this.paths.dbPath, false);
    }

    const nextState: StateFile = {
      schema_version: SCHEMA_VERSION,
      current_download: zipInfo,
    };
    if (
      state?.schema_version !== nextState.schema_version ||
      JSON.stringify(state?.current_download) !==
        JSON.stringify(nextState.current_download)
    ) {
      await writeState(this.paths.statePath, nextState);
    }

    return getDictionaryStatus(this.db, this.paths.rootDir, this.paths.dbPath);
  }

  async refresh(): Promise<DictionaryStatus> {
    await ensurePaths(this.paths);
    const zipInfo = await ensureDownload({
      force: true,
      paths: this.paths,
      downloadUrl: this.options.downloadUrl,
      jsonLinkKey: this.options.jsonLinkKey,
      userAgent: this.options.userAgent,
    });

    await this.#rebuildFromZip(
      zipInfo.zipPath,
      zipInfo.sourceFilename,
      zipInfo.sourceDate,
    );
    await writeState(this.paths.statePath, {
      schema_version: SCHEMA_VERSION,
      current_download: zipInfo,
    });

    return getDictionaryStatus(this.db, this.paths.rootDir, this.paths.dbPath);
  }

  close(): void {
    this.#db?.close();
    this.#db = null;
  }

  #hasCurrentSchema(): boolean {
    try {
      const db = this.#db ?? openDatabase(this.paths.dbPath, true);
      const metadata = readMetadata(db);
      if (!this.#db) {
        db.close();
      }
      return Number(metadata.schema_version) === SCHEMA_VERSION;
    } catch {
      return false;
    }
  }

  async #rebuildFromZip(
    zipPath: string,
    sourceFilename: string,
    sourceDate: string | null,
  ): Promise<void> {
    this.close();

    try {
      await Deno.remove(this.paths.stagingDbPath);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    const stagingDb = openDatabase(this.paths.stagingDbPath, false);
    createSchema(stagingDb);

    let entryCount = 0;
    let batch = createEmptyBatch();

    for await (const item of iterateDumpItems(zipPath)) {
      const appended = appendItemToBatch(batch, item);
      if (appended) {
        entryCount += 1;
      }
      if (batch.entries.length >= BATCH_SIZE) {
        importBatch(stagingDb, batch);
        batch = createEmptyBatch();
      }
    }

    if (batch.entries.length > 0) {
      importBatch(stagingDb, batch);
    }

    const summary: ImportSummary = {
      sourceFilename,
      sourceDate,
      entryCount,
      importedAt: new Date().toISOString(),
    };
    writeMetadata(stagingDb, summary);
    stagingDb.close();

    await replaceDatabase(this.paths.stagingDbPath, this.paths.dbPath);
    this.#db = openDatabase(this.paths.dbPath, false);
  }
}

export async function initializeDictionary(
  options: ServerOptions = {},
): Promise<DictionaryService> {
  const service = new DictionaryService(options);
  await service.initialize();
  return service;
}
