import type {
  ConjugationRecord,
  EntryRecord,
  ImportBatch,
  OriginalLanguageRecord,
  PartOfSpeechRecord,
  PatternGroupRecord,
  PatternRecord,
  PronunciationRecord,
  RelationRecord,
  SenseCategoryRecord,
  SenseExampleRecord,
  SenseGrammarRecord,
  SenseLexicalRelationRecord,
  SenseMultimediaRecord,
  SensePatternRecord,
  SenseRecord,
  SenseTranslationRecord,
} from "../types.ts";
import {
  asNumber,
  asRecord,
  asString,
  normalizeSearchText,
  toArray,
} from "../utils.ts";

export function createEmptyBatch(): ImportBatch {
  return {
    entries: [],
    originalLanguages: [],
    pronunciations: [],
    relations: [],
    conjugations: [],
    partsOfSpeech: [],
    patternGroups: [],
    patterns: [],
    senses: [],
    senseCategories: [],
    senseGrammars: [],
    sensePatterns: [],
    senseExamples: [],
    senseTranslations: [],
    senseLexicalRelations: [],
    senseMultimedia: [],
  };
}

export function appendItemToBatch(
  batch: ImportBatch,
  rawItem: unknown,
): boolean {
  const item = asRecord(rawItem);
  if (!item) {
    return false;
  }

  const targetCode = asNumber(item.target_code);
  const wordInfo = asRecord(item.word_info);
  const word = asString(wordInfo?.word);

  if (targetCode === null || !wordInfo || !word) {
    return false;
  }

  const entry: EntryRecord = {
    targetCode,
    word,
    wordSearch: normalizeSearchText(word),
    wordUnit: asString(wordInfo.word_unit),
    wordType: asString(wordInfo.word_type),
    supNo: asString(wordInfo.sup_no),
    etymology: asString(wordInfo.origin),
    sourceWordRaw: word,
  };
  batch.entries.push(entry);

  addOriginalLanguages(
    batch.originalLanguages,
    targetCode,
    wordInfo.original_language_info,
  );
  addPronunciations(
    batch.pronunciations,
    targetCode,
    wordInfo.pronunciation_info,
  );
  addRelations(batch.relations, targetCode, wordInfo.relation_info);
  addConjugations(batch.conjugations, targetCode, wordInfo.conju_info);
  addPartOfSpeech(batch, targetCode, wordInfo.pos_info);

  return true;
}

function addOriginalLanguages(
  rows: OriginalLanguageRecord[],
  targetCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    if (!row) {
      return;
    }
    rows.push({
      targetCode,
      ordinal: index,
      originalLanguage: asString(row.original_language),
      languageType: asString(row.language_type),
    });
  });
}

function addPronunciations(
  rows: PronunciationRecord[],
  targetCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    if (!row) {
      return;
    }
    rows.push({
      targetCode,
      ordinal: index,
      pronunciation: asString(row.pronunciation),
    });
  });
}

function addRelations(
  rows: RelationRecord[],
  targetCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    if (!row) {
      return;
    }
    rows.push({
      targetCode,
      ordinal: index,
      type: asString(row.type),
      word: asString(row.word),
      linkTargetCode: asString(row.link_target_code),
      link: asString(row.link),
    });
  });
}

function addConjugations(
  rows: ConjugationRecord[],
  targetCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    if (!row) {
      return;
    }

    const conjugationInfo = asRecord(row.conjugation_info);
    if (conjugationInfo) {
      rows.push({
        targetCode,
        ordinal: index * 2,
        kind: "conjugation",
        value: asString(conjugationInfo.conjugation),
        pronunciation: firstPronunciation(conjugationInfo.pronunciation_info),
      });
    }

    const abbreviationInfo = asRecord(row.abbreviation_info);
    if (abbreviationInfo) {
      rows.push({
        targetCode,
        ordinal: index * 2 + 1,
        kind: "abbreviation",
        value: asString(abbreviationInfo.abbreviation),
        pronunciation: firstPronunciation(abbreviationInfo.pronunciation_info),
      });
    }
  });
}

function addPartOfSpeech(
  batch: ImportBatch,
  targetCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    if (!row) {
      return;
    }

    const posCode = asString(row.pos_code) ?? `${targetCode}:${index}`;
    const posRecord: PartOfSpeechRecord = {
      posCode,
      targetCode,
      ordinal: index,
      pos: asString(row.pos),
    };
    batch.partsOfSpeech.push(posRecord);

    const groups = toArray(row.comm_pattern_info);
    groups.forEach((groupValue, groupIndex) => {
      const group = asRecord(groupValue);
      if (!group) {
        return;
      }

      const commPatternCode = asString(group.comm_pattern_code) ??
        `${posCode}:${groupIndex}`;
      const groupRecord: PatternGroupRecord = {
        commPatternCode,
        posCode,
        ordinal: groupIndex,
      };
      batch.patternGroups.push(groupRecord);

      addPatterns(batch.patterns, commPatternCode, group.pattern_info);
      addSenses(batch, commPatternCode, group.sense_info);
    });
  });
}

function addPatterns(
  rows: PatternRecord[],
  commPatternCode: string,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    rows.push({
      commPatternCode,
      ordinal: index,
      pattern: asString(row?.pattern),
    });
  });
}

function addSenses(
  batch: ImportBatch,
  commPatternCode: string,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    if (!row) {
      return;
    }

    const senseCode = asNumber(row.sense_code) ??
      syntheticSenseCode(commPatternCode, index);
    const sense: SenseRecord = {
      senseCode,
      commPatternCode,
      ordinal: index,
      type: asString(row.type),
      definition: asString(row.definition),
      definitionOriginal: asString(row.definition_original),
      scientificName: asString(row.scientific_name),
    };
    batch.senses.push(sense);

    addSenseCategories(batch.senseCategories, senseCode, row.cat_info);
    addSensePatterns(batch.sensePatterns, senseCode, row.sense_pattern_info);
    addSenseGrammars(batch.senseGrammars, senseCode, row.sense_grammar_info);
    addSenseExamples(batch.senseExamples, senseCode, row.example_info);
    addSenseTranslations(
      batch.senseTranslations,
      senseCode,
      row.translation_info,
    );
    addSenseLexicalRelations(
      batch.senseLexicalRelations,
      senseCode,
      row.lexical_info,
    );
    addSenseMultimedia(batch.senseMultimedia, senseCode, row.multimedia_info);
  });
}

function addSenseCategories(
  rows: SenseCategoryRecord[],
  senseCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    rows.push({
      senseCode,
      ordinal: index,
      cat: asString(row?.cat),
    });
  });
}

function addSensePatterns(
  rows: SensePatternRecord[],
  senseCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    rows.push({
      senseCode,
      ordinal: index,
      pattern: asString(row?.pattern),
    });
  });
}

function addSenseGrammars(
  rows: SenseGrammarRecord[],
  senseCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    rows.push({
      senseCode,
      ordinal: index,
      grammar: asString(row?.grammar),
    });
  });
}

function addSenseExamples(
  rows: SenseExampleRecord[],
  senseCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    rows.push({
      senseCode,
      ordinal: index,
      example: asString(row?.example),
      source: asString(row?.source),
      origin: asString(row?.origin),
      translation: asString(row?.translation),
    });
  });
}

function addSenseTranslations(
  rows: SenseTranslationRecord[],
  senseCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    rows.push({
      senseCode,
      ordinal: index,
      translation: asString(row?.translation),
      languageType: asString(row?.language_type),
    });
  });
}

function addSenseLexicalRelations(
  rows: SenseLexicalRelationRecord[],
  senseCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    if (!row) {
      return;
    }
    rows.push({
      senseCode,
      ordinal: index,
      word: asString(row.word),
      unit: asString(row.unit),
      type: asString(row.type),
      linkTargetCode: asString(row.link_target_code),
      link: asString(row.link),
    });
  });
}

function addSenseMultimedia(
  rows: SenseMultimediaRecord[],
  senseCode: number,
  rawValue: unknown,
): void {
  toArray(rawValue).forEach((value, index) => {
    const row = asRecord(value);
    if (!row) {
      return;
    }
    rows.push({
      senseCode,
      ordinal: index,
      label: asString(row.label),
      type: asString(row.type),
      link: asString(row.link),
    });
  });
}

function firstPronunciation(rawValue: unknown): string | null {
  const first = toArray(rawValue).map((value) => asRecord(value)).find(Boolean);
  return asString(first?.pronunciation);
}

function syntheticSenseCode(commPatternCode: string, index: number): number {
  let hash = 0;
  for (const char of commPatternCode) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) * 1000 + index;
}
