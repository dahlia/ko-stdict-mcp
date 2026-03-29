export const DEFAULT_FIELDS = [
  "target_code",
  "word",
  "hanja",
  "sup_no",
  "pos",
  "definition",
] as const;

export const FIELD_NAMES = [
  "target_code",
  "word",
  "hanja",
  "sup_no",
  "word_unit",
  "word_type",
  "pronunciations",
  "pos",
  "definition",
  "definitions",
  "sense_codes",
  "categories",
  "patterns",
  "grammars",
  "examples",
  "relations",
  "translations",
  "etymology",
  "original_languages",
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];
export type DefaultFieldName = (typeof DEFAULT_FIELDS)[number];
export type SearchMatch = "exact" | "prefix" | "contains";

export interface ServerOptions {
  dataDir?: string;
  downloadUrl?: string;
  jsonLinkKey?: string;
  userAgent?: string;
}

export interface ResolvedPaths {
  rootDir: string;
  downloadsDir: string;
  dbDir: string;
  statePath: string;
  dbPath: string;
  stagingDbPath: string;
}

export interface DownloadInfo {
  zipPath: string;
  sourceFilename: string;
  sourceDate: string | null;
  downloadedAt: string;
}

export interface DictionaryStatus {
  ready: boolean;
  data_dir: string;
  db_path: string;
  source_filename: string | null;
  source_date: string | null;
  entry_count: number;
  imported_at: string | null;
  schema_version: number | null;
}

export interface SearchParams {
  query: string;
  match?: SearchMatch;
  limit?: number;
  offset?: number;
  fields?: readonly FieldName[];
}

export interface GetEntryParams {
  target_code: number;
  fields?: readonly FieldName[];
}

export interface SearchResult {
  total: number;
  limit: number;
  offset: number;
  match: SearchMatch;
  source_date: string | null;
  items: EntryProjection[];
}

export interface EntryProjection {
  target_code?: number;
  word?: string;
  hanja?: string[];
  sup_no?: string | null;
  word_unit?: string | null;
  word_type?: string | null;
  pronunciations?: string[];
  pos?: string[];
  definition?: string | null;
  definitions?: string[];
  sense_codes?: number[];
  categories?: string[];
  patterns?: string[];
  grammars?: string[];
  examples?: ExampleProjection[];
  relations?: RelationProjection[];
  translations?: TranslationProjection[];
  etymology?: string | null;
  original_languages?: OriginalLanguageProjection[];
}

export interface ExampleProjection {
  example: string;
  source?: string | null;
  origin?: string | null;
  translation?: string | null;
}

export interface RelationProjection {
  type: string | null;
  word: string | null;
  link_target_code: string | null;
  link: string | null;
}

export interface TranslationProjection {
  translation: string | null;
  language_type: string | null;
}

export interface OriginalLanguageProjection {
  original_language: string | null;
  language_type: string | null;
}

export interface StateFile {
  schema_version: number;
  current_download?: DownloadInfo;
}

export interface RawDictionaryFile {
  channel?: {
    item?: unknown;
  };
}

export interface ImportSummary {
  sourceFilename: string;
  sourceDate: string | null;
  entryCount: number;
  importedAt: string;
}

export interface EntryRecord {
  targetCode: number;
  word: string;
  wordSearch: string;
  wordUnit: string | null;
  wordType: string | null;
  supNo: string | null;
  etymology: string | null;
  sourceWordRaw: string;
}

export interface OriginalLanguageRecord {
  targetCode: number;
  ordinal: number;
  originalLanguage: string | null;
  languageType: string | null;
}

export interface PronunciationRecord {
  targetCode: number;
  ordinal: number;
  pronunciation: string | null;
}

export interface RelationRecord {
  targetCode: number;
  ordinal: number;
  type: string | null;
  word: string | null;
  linkTargetCode: string | null;
  link: string | null;
}

export interface ConjugationRecord {
  targetCode: number;
  ordinal: number;
  kind: "conjugation" | "abbreviation";
  value: string | null;
  pronunciation: string | null;
}

export interface PartOfSpeechRecord {
  posCode: string;
  targetCode: number;
  ordinal: number;
  pos: string | null;
}

export interface PatternGroupRecord {
  commPatternCode: string;
  posCode: string;
  ordinal: number;
}

export interface PatternRecord {
  commPatternCode: string;
  ordinal: number;
  pattern: string | null;
}

export interface SenseRecord {
  senseCode: number;
  commPatternCode: string;
  ordinal: number;
  type: string | null;
  definition: string | null;
  definitionOriginal: string | null;
  scientificName: string | null;
}

export interface SenseCategoryRecord {
  senseCode: number;
  ordinal: number;
  cat: string | null;
}

export interface SenseGrammarRecord {
  senseCode: number;
  ordinal: number;
  grammar: string | null;
}

export interface SensePatternRecord {
  senseCode: number;
  ordinal: number;
  pattern: string | null;
}

export interface SenseExampleRecord {
  senseCode: number;
  ordinal: number;
  example: string | null;
  source: string | null;
  origin: string | null;
  translation: string | null;
}

export interface SenseTranslationRecord {
  senseCode: number;
  ordinal: number;
  translation: string | null;
  languageType: string | null;
}

export interface SenseLexicalRelationRecord {
  senseCode: number;
  ordinal: number;
  word: string | null;
  unit: string | null;
  type: string | null;
  linkTargetCode: string | null;
  link: string | null;
}

export interface SenseMultimediaRecord {
  senseCode: number;
  ordinal: number;
  label: string | null;
  type: string | null;
  link: string | null;
}

export interface ImportBatch {
  entries: EntryRecord[];
  originalLanguages: OriginalLanguageRecord[];
  pronunciations: PronunciationRecord[];
  relations: RelationRecord[];
  conjugations: ConjugationRecord[];
  partsOfSpeech: PartOfSpeechRecord[];
  patternGroups: PatternGroupRecord[];
  patterns: PatternRecord[];
  senses: SenseRecord[];
  senseCategories: SenseCategoryRecord[];
  senseGrammars: SenseGrammarRecord[];
  sensePatterns: SensePatternRecord[];
  senseExamples: SenseExampleRecord[];
  senseTranslations: SenseTranslationRecord[];
  senseLexicalRelations: SenseLexicalRelationRecord[];
  senseMultimedia: SenseMultimediaRecord[];
}

export interface DownloadOptions {
  force: boolean;
  paths: ResolvedPaths;
  downloadUrl: string;
  jsonLinkKey: string;
  userAgent: string;
}
