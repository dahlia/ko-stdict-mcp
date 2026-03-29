export { createStdictServer, runStdioServer } from "./src/mcp/server.ts";
export { DictionaryService, initializeDictionary } from "./src/dictionary.ts";
export {
  getDictionaryStatus,
  getEntry,
  searchEntries,
} from "./src/query/search.ts";
export type {
  DictionaryStatus,
  EntryProjection,
  FieldName,
  GetEntryParams,
  SearchMatch,
  SearchParams,
  SearchResult,
  ServerOptions,
} from "./src/types.ts";
