import { DatabaseSync } from "node:sqlite";
import { move } from "@std/fs";
import { SCHEMA_VERSION } from "../config.ts";
import type { ImportBatch, ImportSummary } from "../types.ts";

export type SqliteDatabase = DatabaseSync;

export function openDatabase(path: string, readonly = false): SqliteDatabase {
  return new DatabaseSync(path, {
    readOnly: readonly,
    enableForeignKeyConstraints: true,
    timeout: 5_000,
  });
}

export function createSchema(db: SqliteDatabase): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;

    CREATE TABLE IF NOT EXISTS entries (
      target_code INTEGER PRIMARY KEY,
      word TEXT NOT NULL,
      word_search TEXT NOT NULL,
      word_unit TEXT,
      word_type TEXT,
      sup_no TEXT,
      etymology TEXT,
      source_word_raw TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS original_languages (
      target_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      original_language TEXT,
      language_type TEXT
    );

    CREATE TABLE IF NOT EXISTS pronunciations (
      target_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      pronunciation TEXT
    );

    CREATE TABLE IF NOT EXISTS relations (
      target_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      type TEXT,
      word TEXT,
      link_target_code TEXT,
      link TEXT
    );

    CREATE TABLE IF NOT EXISTS conjugations (
      target_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      kind TEXT NOT NULL,
      value TEXT,
      pronunciation TEXT
    );

    CREATE TABLE IF NOT EXISTS parts_of_speech (
      pos_code TEXT PRIMARY KEY,
      target_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      pos TEXT
    );

    CREATE TABLE IF NOT EXISTS pattern_groups (
      comm_pattern_code TEXT PRIMARY KEY,
      pos_code TEXT NOT NULL,
      ordinal INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patterns (
      comm_pattern_code TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      pattern TEXT
    );

    CREATE TABLE IF NOT EXISTS senses (
      sense_code INTEGER PRIMARY KEY,
      comm_pattern_code TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      type TEXT,
      definition TEXT,
      definition_original TEXT,
      scientific_name TEXT
    );

    CREATE TABLE IF NOT EXISTS sense_categories (
      sense_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      cat TEXT
    );

    CREATE TABLE IF NOT EXISTS sense_patterns (
      sense_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      pattern TEXT
    );

    CREATE TABLE IF NOT EXISTS sense_grammars (
      sense_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      grammar TEXT
    );

    CREATE TABLE IF NOT EXISTS sense_examples (
      sense_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      example TEXT,
      source TEXT,
      origin TEXT,
      translation TEXT
    );

    CREATE TABLE IF NOT EXISTS sense_translations (
      sense_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      translation TEXT,
      language_type TEXT
    );

    CREATE TABLE IF NOT EXISTS sense_lexical_relations (
      sense_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      word TEXT,
      unit TEXT,
      type TEXT,
      link_target_code TEXT,
      link TEXT
    );

    CREATE TABLE IF NOT EXISTS sense_multimedia (
      sense_code INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      label TEXT,
      type TEXT,
      link TEXT
    );

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entries_word_search ON entries (word_search);
    CREATE INDEX IF NOT EXISTS idx_pos_target_code ON parts_of_speech (target_code, ordinal);
    CREATE INDEX IF NOT EXISTS idx_patterns_group ON patterns (comm_pattern_code, ordinal);
    CREATE INDEX IF NOT EXISTS idx_senses_group ON senses (comm_pattern_code, ordinal);
    CREATE INDEX IF NOT EXISTS idx_examples_sense ON sense_examples (sense_code, ordinal);
    CREATE INDEX IF NOT EXISTS idx_categories_sense ON sense_categories (sense_code, ordinal);
    CREATE INDEX IF NOT EXISTS idx_translations_sense ON sense_translations (sense_code, ordinal);
  `);
}

export function clearSchema(db: SqliteDatabase): void {
  db.exec(`
    DELETE FROM entries;
    DELETE FROM original_languages;
    DELETE FROM pronunciations;
    DELETE FROM relations;
    DELETE FROM conjugations;
    DELETE FROM parts_of_speech;
    DELETE FROM pattern_groups;
    DELETE FROM patterns;
    DELETE FROM senses;
    DELETE FROM sense_categories;
    DELETE FROM sense_patterns;
    DELETE FROM sense_grammars;
    DELETE FROM sense_examples;
    DELETE FROM sense_translations;
    DELETE FROM sense_lexical_relations;
    DELETE FROM sense_multimedia;
    DELETE FROM metadata;
  `);
}

export function importBatch(db: SqliteDatabase, batch: ImportBatch): void {
  if (batch.entries.length === 0) {
    return;
  }

  const insertEntry = db.prepare(`
    INSERT INTO entries (
      target_code, word, word_search, word_unit, word_type, sup_no, etymology, source_word_raw
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOriginalLanguage = db.prepare(`
    INSERT INTO original_languages (target_code, ordinal, original_language, language_type)
    VALUES (?, ?, ?, ?)
  `);
  const insertPronunciation = db.prepare(`
    INSERT INTO pronunciations (target_code, ordinal, pronunciation)
    VALUES (?, ?, ?)
  `);
  const insertRelation = db.prepare(`
    INSERT INTO relations (target_code, ordinal, type, word, link_target_code, link)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertConjugation = db.prepare(`
    INSERT INTO conjugations (target_code, ordinal, kind, value, pronunciation)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertPos = db.prepare(`
    INSERT INTO parts_of_speech (pos_code, target_code, ordinal, pos)
    VALUES (?, ?, ?, ?)
  `);
  const insertPatternGroup = db.prepare(`
    INSERT INTO pattern_groups (comm_pattern_code, pos_code, ordinal)
    VALUES (?, ?, ?)
  `);
  const insertPattern = db.prepare(`
    INSERT INTO patterns (comm_pattern_code, ordinal, pattern)
    VALUES (?, ?, ?)
  `);
  const insertSense = db.prepare(`
    INSERT INTO senses (
      sense_code, comm_pattern_code, ordinal, type, definition, definition_original, scientific_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSenseCategory = db.prepare(`
    INSERT INTO sense_categories (sense_code, ordinal, cat)
    VALUES (?, ?, ?)
  `);
  const insertSensePattern = db.prepare(`
    INSERT INTO sense_patterns (sense_code, ordinal, pattern)
    VALUES (?, ?, ?)
  `);
  const insertSenseGrammar = db.prepare(`
    INSERT INTO sense_grammars (sense_code, ordinal, grammar)
    VALUES (?, ?, ?)
  `);
  const insertSenseExample = db.prepare(`
    INSERT INTO sense_examples (sense_code, ordinal, example, source, origin, translation)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertSenseTranslation = db.prepare(`
    INSERT INTO sense_translations (sense_code, ordinal, translation, language_type)
    VALUES (?, ?, ?, ?)
  `);
  const insertSenseLexicalRelation = db.prepare(`
    INSERT INTO sense_lexical_relations (
      sense_code, ordinal, word, unit, type, link_target_code, link
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSenseMultimedia = db.prepare(`
    INSERT INTO sense_multimedia (sense_code, ordinal, label, type, link)
    VALUES (?, ?, ?, ?, ?)
  `);

  withTransaction(db, () => {
    for (const row of batch.entries) {
      insertEntry.run(
        row.targetCode,
        row.word,
        row.wordSearch,
        row.wordUnit,
        row.wordType,
        row.supNo,
        row.etymology,
        row.sourceWordRaw,
      );
    }
    for (const row of batch.originalLanguages) {
      insertOriginalLanguage.run(
        row.targetCode,
        row.ordinal,
        row.originalLanguage,
        row.languageType,
      );
    }
    for (const row of batch.pronunciations) {
      insertPronunciation.run(row.targetCode, row.ordinal, row.pronunciation);
    }
    for (const row of batch.relations) {
      insertRelation.run(
        row.targetCode,
        row.ordinal,
        row.type,
        row.word,
        row.linkTargetCode,
        row.link,
      );
    }
    for (const row of batch.conjugations) {
      insertConjugation.run(
        row.targetCode,
        row.ordinal,
        row.kind,
        row.value,
        row.pronunciation,
      );
    }
    for (const row of batch.partsOfSpeech) {
      insertPos.run(row.posCode, row.targetCode, row.ordinal, row.pos);
    }
    for (const row of batch.patternGroups) {
      insertPatternGroup.run(row.commPatternCode, row.posCode, row.ordinal);
    }
    for (const row of batch.patterns) {
      insertPattern.run(row.commPatternCode, row.ordinal, row.pattern);
    }
    for (const row of batch.senses) {
      insertSense.run(
        row.senseCode,
        row.commPatternCode,
        row.ordinal,
        row.type,
        row.definition,
        row.definitionOriginal,
        row.scientificName,
      );
    }
    for (const row of batch.senseCategories) {
      insertSenseCategory.run(row.senseCode, row.ordinal, row.cat);
    }
    for (const row of batch.sensePatterns) {
      insertSensePattern.run(row.senseCode, row.ordinal, row.pattern);
    }
    for (const row of batch.senseGrammars) {
      insertSenseGrammar.run(row.senseCode, row.ordinal, row.grammar);
    }
    for (const row of batch.senseExamples) {
      insertSenseExample.run(
        row.senseCode,
        row.ordinal,
        row.example,
        row.source,
        row.origin,
        row.translation,
      );
    }
    for (const row of batch.senseTranslations) {
      insertSenseTranslation.run(
        row.senseCode,
        row.ordinal,
        row.translation,
        row.languageType,
      );
    }
    for (const row of batch.senseLexicalRelations) {
      insertSenseLexicalRelation.run(
        row.senseCode,
        row.ordinal,
        row.word,
        row.unit,
        row.type,
        row.linkTargetCode,
        row.link,
      );
    }
    for (const row of batch.senseMultimedia) {
      insertSenseMultimedia.run(
        row.senseCode,
        row.ordinal,
        row.label,
        row.type,
        row.link,
      );
    }
  });
}

export function writeMetadata(
  db: SqliteDatabase,
  summary: ImportSummary,
): void {
  const upsert = db.prepare(`
    INSERT INTO metadata (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const pairs = [
    ["schema_version", String(SCHEMA_VERSION)],
    ["source_filename", summary.sourceFilename],
    ["source_date", summary.sourceDate ?? ""],
    ["entry_count", String(summary.entryCount)],
    ["imported_at", summary.importedAt],
  ];

  withTransaction(db, () => {
    for (const [key, value] of pairs) {
      upsert.run(key, value);
    }
  });
}

export function readMetadata(db: SqliteDatabase): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM metadata").all() as Array<{
    key: string;
    value: string;
  }>;
  const metadata: Record<string, string> = {};
  for (const row of rows) {
    metadata[row.key] = row.value;
  }
  return metadata;
}

export async function replaceDatabase(
  stagingPath: string,
  finalPath: string,
): Promise<void> {
  try {
    await Deno.remove(finalPath);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  await move(stagingPath, finalPath, { overwrite: true });
}

function withTransaction(db: SqliteDatabase, callback: () => void): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    callback();
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback failure after the original error
    }
    throw error;
  }
}
