import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../config.ts";
import { DictionaryService, initializeDictionary } from "../dictionary.ts";
import {
  getDictionaryStatus,
  getEntry,
  searchEntries,
} from "../query/search.ts";
import { FIELD_NAMES } from "../types.ts";
import type { ServerOptions } from "../types.ts";
import { jsonText, pickFields } from "../utils.ts";

const fieldEnum = z.enum(FIELD_NAMES);

export async function createStdictServer(options: ServerOptions = {}): Promise<{
  mcpServer: McpServer;
  dictionary: DictionaryService;
}> {
  const dictionary = await initializeDictionary(options);
  const mcpServer = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  mcpServer.registerTool(
    "search_entries",
    {
      title: "Search Entries",
      description: "Search standard Korean dictionary entries by headword.",
      inputSchema: {
        query: z.string().min(1).describe("Headword query string"),
        match: z.enum(["exact", "prefix", "contains"]).default("prefix"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        fields: z.array(fieldEnum).optional().describe(
          "Fields to include in each item",
        ),
      },
    },
    ({ query, match, limit, offset, fields }) => {
      const result = searchEntries(dictionary.db, {
        query,
        match,
        limit,
        offset,
        fields: pickFields(fields),
      });
      const structuredContent = toStructuredContent(result);

      return {
        content: [{ type: "text", text: jsonText(result) }],
        structuredContent,
      };
    },
  );

  mcpServer.registerTool(
    "get_entry",
    {
      title: "Get Entry",
      description: "Look up a normalized dictionary entry by target_code.",
      inputSchema: {
        target_code: z.number().int().describe("Dictionary target code"),
        fields: z.array(fieldEnum).optional().describe(
          "Fields to include in the result",
        ),
      },
    },
    ({ target_code, fields }) => {
      const result = getEntry(dictionary.db, {
        target_code,
        fields: pickFields(fields),
      });

      if (!result) {
        return {
          content: [{ type: "text", text: `Entry ${target_code} not found.` }],
          isError: true,
        };
      }

      const structuredContent = toStructuredContent(result);
      return {
        content: [{ type: "text", text: jsonText(result) }],
        structuredContent,
      };
    },
  );

  mcpServer.registerTool(
    "dictionary_status",
    {
      title: "Dictionary Status",
      description: "Return local dictionary cache and import status.",
      inputSchema: {},
    },
    () => {
      const result = getDictionaryStatus(
        dictionary.db,
        dictionary.paths.rootDir,
        dictionary.paths.dbPath,
      );
      const structuredContent = toStructuredContent(result);
      return {
        content: [{ type: "text", text: jsonText(result) }],
        structuredContent,
      };
    },
  );

  mcpServer.registerTool(
    "refresh_dictionary",
    {
      title: "Refresh Dictionary",
      description:
        "Download the official dump again and rebuild the local SQLite database.",
      inputSchema: {},
    },
    async () => {
      const result = await dictionary.refresh();
      const structuredContent = toStructuredContent(result);
      return {
        content: [{ type: "text", text: jsonText(result) }],
        structuredContent,
      };
    },
  );

  return { mcpServer, dictionary };
}

export async function runStdioServer(
  options: ServerOptions = {},
): Promise<void> {
  const { mcpServer } = await createStdictServer(options);
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

function toStructuredContent(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
