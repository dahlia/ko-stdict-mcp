import { DEFAULT_LIMIT, MAX_LIMIT } from "../config.ts";
import type { SqliteDatabase } from "../import/sqlite.ts";
import type {
  DictionaryStatus,
  EntryProjection,
  ExampleProjection,
  FieldName,
  GetEntryParams,
  OriginalLanguageProjection,
  RelationProjection,
  SearchMatch,
  SearchParams,
  SearchResult,
  TranslationProjection,
} from "../types.ts";
import { normalizeSearchText, pickFields, uniqueNonEmpty } from "../utils.ts";
import { readMetadata } from "../import/sqlite.ts";

type EntryRow = {
  target_code: number;
  word: string;
  word_unit: string | null;
  word_type: string | null;
  sup_no: string | null;
  etymology: string | null;
};

export function searchEntries(
  db: SqliteDatabase,
  params: SearchParams,
): SearchResult {
  const query = params.query.trim();
  if (!query) {
    throw new Error("query is required");
  }

  const fields = pickFields(params.fields);
  const match: SearchMatch = params.match ?? "prefix";
  const limit = clampLimit(params.limit);
  const offset = Math.max(0, params.offset ?? 0);
  const searchValue = normalizeSearchText(query);

  const where = buildWhereClause(match);
  const countRow = db.prepare(
    `SELECT COUNT(*) AS total FROM entries WHERE ${where}`,
  ).get(searchValue) as { total: number } | undefined;
  const total = countRow?.total ?? 0;

  const rows = db.prepare(
    `
      SELECT
        target_code,
        word,
        word_unit,
        word_type,
        sup_no,
        etymology
      FROM entries
      WHERE ${where}
      ORDER BY
        CASE WHEN word_search = ? THEN 0 ELSE 1 END,
        CASE WHEN word_search LIKE ? THEN 0 ELSE 1 END,
        word ASC,
        target_code ASC
      LIMIT ? OFFSET ?
    `,
  ).all(
    searchValue,
    searchValue,
    `${searchValue}%`,
    limit,
    offset,
  ) as EntryRow[];

  const items = rows.map((row) => projectEntry(db, row, fields));
  const metadata = readMetadata(db);

  return {
    total,
    limit,
    offset,
    match,
    source_date: metadata.source_date || null,
    items,
  };
}

export function getEntry(
  db: SqliteDatabase,
  params: GetEntryParams,
): EntryProjection | null {
  const fields = pickFields(params.fields);
  const row = db.prepare(
    `
      SELECT
        target_code,
        word,
        word_unit,
        word_type,
        sup_no,
        etymology
      FROM entries
      WHERE target_code = ?
    `,
  ).get(params.target_code) as EntryRow | undefined;

  if (!row) {
    return null;
  }

  return projectEntry(db, row, fields);
}

export function getDictionaryStatus(
  db: SqliteDatabase,
  dataDir: string,
  dbPath: string,
): DictionaryStatus {
  const metadata = readMetadata(db);
  const entryCount = (
    db.prepare("SELECT COUNT(*) AS count FROM entries").get() as {
      count: number;
    } | undefined
  )?.count ?? 0;

  return {
    ready: entryCount > 0,
    data_dir: dataDir,
    db_path: dbPath,
    source_filename: metadata.source_filename || null,
    source_date: metadata.source_date || null,
    entry_count: entryCount,
    imported_at: metadata.imported_at || null,
    schema_version: metadata.schema_version
      ? Number(metadata.schema_version)
      : null,
  };
}

function buildWhereClause(match: SearchMatch): string {
  switch (match) {
    case "exact":
      return "word_search = ?";
    case "contains":
      return "word_search LIKE '%' || ? || '%'";
    case "prefix":
    default:
      return "word_search LIKE ? || '%'";
  }
}

function clampLimit(limit?: number): number {
  if (!limit) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limit)));
}

function projectEntry(
  db: SqliteDatabase,
  row: EntryRow,
  fields: readonly FieldName[],
): EntryProjection {
  const projection: EntryProjection = {};
  const fieldSet = new Set(fields);

  if (fieldSet.has("target_code")) {
    projection.target_code = row.target_code;
  }
  if (fieldSet.has("word")) {
    projection.word = row.word;
  }
  if (fieldSet.has("word_unit")) {
    projection.word_unit = row.word_unit;
  }
  if (fieldSet.has("word_type")) {
    projection.word_type = row.word_type;
  }
  if (fieldSet.has("sup_no")) {
    projection.sup_no = row.sup_no;
  }
  if (fieldSet.has("etymology")) {
    projection.etymology = row.etymology;
  }
  if (fieldSet.has("hanja") || fieldSet.has("original_languages")) {
    const originalLanguages = getOriginalLanguages(db, row.target_code);
    if (fieldSet.has("original_languages")) {
      projection.original_languages = originalLanguages;
    }
    if (fieldSet.has("hanja")) {
      projection.hanja = uniqueNonEmpty(
        originalLanguages
          .filter((language) => language.language_type === "한자")
          .map((language) => language.original_language),
      );
    }
  }
  if (fieldSet.has("pronunciations")) {
    projection.pronunciations = getPronunciations(db, row.target_code);
  }
  if (fieldSet.has("pos")) {
    projection.pos = getPartsOfSpeech(db, row.target_code);
  }

  const needsSenseData = [
    "definition",
    "definitions",
    "sense_codes",
    "categories",
    "patterns",
    "grammars",
    "examples",
    "translations",
  ].some((field) => fieldSet.has(field as FieldName));

  if (needsSenseData) {
    const senses = getSenseRows(db, row.target_code);
    if (fieldSet.has("definition")) {
      projection.definition = senses[0]?.definition ?? null;
    }
    if (fieldSet.has("definitions")) {
      projection.definitions = uniqueNonEmpty(
        senses.map((sense) => sense.definition),
      );
    }
    if (fieldSet.has("sense_codes")) {
      projection.sense_codes = senses.map((sense) => sense.sense_code);
    }
    if (fieldSet.has("categories")) {
      projection.categories = getSenseCategories(
        db,
        senses.map((sense) => sense.sense_code),
      );
    }
    if (fieldSet.has("patterns")) {
      projection.patterns = getPatterns(db, row.target_code);
    }
    if (fieldSet.has("grammars")) {
      projection.grammars = getSenseGrammars(
        db,
        senses.map((sense) => sense.sense_code),
      );
    }
    if (fieldSet.has("examples")) {
      projection.examples = getExamples(
        db,
        senses.map((sense) => sense.sense_code),
      );
    }
    if (fieldSet.has("translations")) {
      projection.translations = getTranslations(
        db,
        senses.map((sense) => sense.sense_code),
      );
    }
  }

  if (fieldSet.has("relations")) {
    projection.relations = getRelations(db, row.target_code);
  }

  return projection;
}

function getOriginalLanguages(
  db: SqliteDatabase,
  targetCode: number,
): OriginalLanguageProjection[] {
  return db.prepare(
    `
      SELECT original_language, language_type
      FROM original_languages
      WHERE target_code = ?
      ORDER BY ordinal ASC
    `,
  ).all(targetCode) as unknown as OriginalLanguageProjection[];
}

function getPronunciations(db: SqliteDatabase, targetCode: number): string[] {
  const rows = db.prepare(
    `
      SELECT pronunciation
      FROM pronunciations
      WHERE target_code = ?
      ORDER BY ordinal ASC
    `,
  ).all(targetCode) as Array<{ pronunciation: string | null }>;
  return uniqueNonEmpty(rows.map((row) => row.pronunciation));
}

function getPartsOfSpeech(db: SqliteDatabase, targetCode: number): string[] {
  const rows = db.prepare(
    `
      SELECT pos
      FROM parts_of_speech
      WHERE target_code = ?
      ORDER BY ordinal ASC
    `,
  ).all(targetCode) as Array<{ pos: string | null }>;
  return uniqueNonEmpty(rows.map((row) => row.pos));
}

function getSenseRows(db: SqliteDatabase, targetCode: number): Array<{
  sense_code: number;
  definition: string | null;
}> {
  return db.prepare(
    `
      SELECT s.sense_code, s.definition
      FROM senses AS s
      JOIN pattern_groups AS pg ON pg.comm_pattern_code = s.comm_pattern_code
      JOIN parts_of_speech AS p ON p.pos_code = pg.pos_code
      WHERE p.target_code = ?
      ORDER BY p.ordinal ASC, pg.ordinal ASC, s.ordinal ASC
    `,
  ).all(targetCode) as Array<{ sense_code: number; definition: string | null }>;
}

function getSenseCategories(
  db: SqliteDatabase,
  senseCodes: number[],
): string[] {
  if (senseCodes.length === 0) {
    return [];
  }

  const placeholders = senseCodes.map(() => "?").join(", ");
  const rows = db.prepare(
    `
      SELECT cat
      FROM sense_categories
      WHERE sense_code IN (${placeholders})
      ORDER BY sense_code ASC, ordinal ASC
    `,
  ).all(...senseCodes) as Array<{ cat: string | null }>;

  return uniqueNonEmpty(
    rows.map((row) => row.cat).filter((value) => value !== "없음"),
  );
}

function getPatterns(db: SqliteDatabase, targetCode: number): string[] {
  const rows = db.prepare(
    `
      SELECT pat.pattern
      FROM patterns AS pat
      JOIN pattern_groups AS pg ON pg.comm_pattern_code = pat.comm_pattern_code
      JOIN parts_of_speech AS p ON p.pos_code = pg.pos_code
      WHERE p.target_code = ?
      ORDER BY p.ordinal ASC, pg.ordinal ASC, pat.ordinal ASC
    `,
  ).all(targetCode) as Array<{ pattern: string | null }>;

  return uniqueNonEmpty(rows.map((row) => row.pattern));
}

function getSenseGrammars(db: SqliteDatabase, senseCodes: number[]): string[] {
  if (senseCodes.length === 0) {
    return [];
  }

  const placeholders = senseCodes.map(() => "?").join(", ");
  const rows = db.prepare(
    `
      SELECT grammar
      FROM sense_grammars
      WHERE sense_code IN (${placeholders})
      ORDER BY sense_code ASC, ordinal ASC
    `,
  ).all(...senseCodes) as Array<{ grammar: string | null }>;

  return uniqueNonEmpty(rows.map((row) => row.grammar));
}

function getExamples(
  db: SqliteDatabase,
  senseCodes: number[],
): ExampleProjection[] {
  if (senseCodes.length === 0) {
    return [];
  }

  const placeholders = senseCodes.map(() => "?").join(", ");
  const rows = db.prepare(
    `
      SELECT example, source, origin, translation
      FROM sense_examples
      WHERE sense_code IN (${placeholders})
      ORDER BY sense_code ASC, ordinal ASC
    `,
  ).all(...senseCodes) as Array<{
    example: string | null;
    source: string | null;
    origin: string | null;
    translation: string | null;
  }>;

  return rows
    .filter((row) => row.example)
    .map((row) => ({
      example: row.example!,
      source: row.source,
      origin: row.origin,
      translation: row.translation,
    }));
}

function getTranslations(
  db: SqliteDatabase,
  senseCodes: number[],
): TranslationProjection[] {
  if (senseCodes.length === 0) {
    return [];
  }

  const placeholders = senseCodes.map(() => "?").join(", ");
  const rows = db.prepare(
    `
      SELECT translation, language_type
      FROM sense_translations
      WHERE sense_code IN (${placeholders})
      ORDER BY sense_code ASC, ordinal ASC
    `,
  ).all(...senseCodes) as unknown as TranslationProjection[];

  return rows.filter((row) => row.translation !== null);
}

function getRelations(
  db: SqliteDatabase,
  targetCode: number,
): RelationProjection[] {
  return db.prepare(
    `
      SELECT type, word, link_target_code, link
      FROM relations
      WHERE target_code = ?
      ORDER BY ordinal ASC
    `,
  ).all(targetCode) as unknown as RelationProjection[];
}
