import { assertEquals, assertExists } from "@std/assert";
import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { DictionaryService } from "../src/dictionary.ts";
import { getEntry, searchEntries } from "../src/query/search.ts";

async function createDumpZip(items: unknown[]): Promise<Uint8Array> {
  const writer = new BlobWriter("application/zip");
  const zipWriter = new ZipWriter(writer);

  try {
    const json = JSON.stringify({
      channel: {
        total: items.length,
        item: items,
      },
    });
    await zipWriter.add("1538740_5000.json", new TextReader(json));
    const blob = await zipWriter.close();
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    // zipWriter.close() finalizes when possible; ignore double-close attempts.
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function makeEntry(params: {
  targetCode: number;
  word: string;
  definition: string;
  pos: string;
  originalLanguage?: string;
  category?: string;
  example?: string;
}): Record<string, unknown> {
  return {
    target_code: params.targetCode,
    word_info: {
      word: params.word,
      word_unit: "단어",
      word_type: params.originalLanguage ? "한자어" : "고유어",
      original_language_info: params.originalLanguage
        ? [{
          original_language: params.originalLanguage,
          language_type: "한자",
        }]
        : [],
      pronunciation_info: [{ pronunciation: params.word.replace(/[-^]/g, "") }],
      pos_info: [
        {
          pos_code: `${params.targetCode}001`,
          pos: params.pos,
          comm_pattern_info: [
            {
              comm_pattern_code: `${params.targetCode}001001`,
              pattern_info: [{ pattern: "…을" }],
              sense_info: [
                {
                  sense_code: params.targetCode * 10,
                  type: "일반어",
                  definition: params.definition,
                  definition_original: params.definition,
                  cat_info: params.category ? [{ cat: params.category }] : [],
                  example_info: params.example
                    ? [{ example: params.example }]
                    : [],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

Deno.test({
  name: "initialize downloads dump and exposes normalized search data",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const tempDir = await Deno.makeTempDir();
    let server: Deno.HttpServer<Deno.NetAddr> | undefined;
    const abortController = new AbortController();
    const requests: string[] = [];

    try {
      const zipBytes = await createDumpZip([
        makeEntry({
          targetCode: 1001,
          word: "나무",
          definition: "줄기나 가지가 목질로 된 여러해살이 식물.",
          pos: "명사",
          category: "식물",
          example: "나무가 우거진 산.",
        }),
        makeEntry({
          targetCode: 1002,
          word: "점진",
          definition: "조금씩 앞으로 나아감.",
          pos: "명사",
          originalLanguage: "漸進",
        }),
      ]);

      server = Deno.serve(
        { hostname: "127.0.0.1", port: 0, signal: abortController.signal },
        (request) => {
          requests.push(request.method);
          return new Response(toArrayBuffer(zipBytes), {
            headers: {
              "content-type": "application/octet-stream",
              "content-disposition":
                "attachment;filename=stdict_JSON_20260306.zip",
            },
          });
        },
      );

      const service = new DictionaryService({
        dataDir: tempDir,
        downloadUrl: `http://127.0.0.1:${server.addr.port}/download`,
      });

      try {
        const status = await service.initialize();
        assertEquals(status.entry_count, 2);
        assertEquals(status.source_date, "2026-03-06");
        assertEquals(requests.length, 1);

        const search = searchEntries(service.db, {
          query: "점진",
          match: "exact",
          fields: ["word", "definition", "hanja"],
        });
        assertEquals(search.total, 1);
        assertEquals(search.items[0].word, "점진");
        assertEquals(search.items[0].definition, "조금씩 앞으로 나아감.");
        assertEquals(search.items[0].hanja, ["漸進"]);

        const entry = getEntry(service.db, {
          target_code: 1001,
          fields: ["word", "definitions", "categories", "examples"],
        });
        assertExists(entry);
        assertEquals(entry.word, "나무");
        assertEquals(entry.definitions, [
          "줄기나 가지가 목질로 된 여러해살이 식물.",
        ]);
        assertEquals(entry.categories, ["식물"]);
        assertEquals(entry.examples?.[0].example, "나무가 우거진 산.");
      } finally {
        service.close();
      }
    } finally {
      abortController.abort();
      await server?.finished.catch(() => undefined);
      await Deno.remove(tempDir, { recursive: true });
    }
  },
});

Deno.test({
  name: "initialize reuses cached zip and database without redownloading",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const tempDir = await Deno.makeTempDir();
    let server: Deno.HttpServer<Deno.NetAddr> | undefined;
    const abortController = new AbortController();
    let requestCount = 0;

    try {
      const zipBytes = await createDumpZip([
        makeEntry({
          targetCode: 2001,
          word: "재주-껏",
          definition: "있는 재주를 다하여.",
          pos: "부사",
        }),
      ]);

      server = Deno.serve(
        { hostname: "127.0.0.1", port: 0, signal: abortController.signal },
        () => {
          requestCount += 1;
          return new Response(toArrayBuffer(zipBytes), {
            headers: {
              "content-type": "application/octet-stream",
              "content-disposition":
                "attachment;filename=stdict_JSON_20260306.zip",
            },
          });
        },
      );

      const downloadUrl = `http://127.0.0.1:${server.addr.port}/download`;

      const first = new DictionaryService({ dataDir: tempDir, downloadUrl });
      await first.initialize();
      first.close();

      const second = new DictionaryService({ dataDir: tempDir, downloadUrl });
      try {
        const status = await second.initialize();
        assertEquals(status.entry_count, 1);
        assertEquals(requestCount, 1);
      } finally {
        second.close();
      }
    } finally {
      abortController.abort();
      await server?.finished.catch(() => undefined);
      await Deno.remove(tempDir, { recursive: true });
    }
  },
});

Deno.test({
  name: "refresh downloads a new dump and replaces the database",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const tempDir = await Deno.makeTempDir();
    let server: Deno.HttpServer<Deno.NetAddr> | undefined;
    const abortController = new AbortController();
    let version = 1;

    try {
      server = Deno.serve(
        { hostname: "127.0.0.1", port: 0, signal: abortController.signal },
        async () => {
          const payload = version === 1
            ? await createDumpZip([
              makeEntry({
                targetCode: 3001,
                word: "처음말",
                definition: "처음 버전 항목.",
                pos: "명사",
              }),
            ])
            : await createDumpZip([
              makeEntry({
                targetCode: 3002,
                word: "나중말",
                definition: "갱신 뒤 항목.",
                pos: "명사",
              }),
            ]);

          const filename = version === 1
            ? "stdict_JSON_20260306.zip"
            : "stdict_JSON_20260401.zip";
          return new Response(toArrayBuffer(payload), {
            headers: {
              "content-type": "application/octet-stream",
              "content-disposition": `attachment;filename=${filename}`,
            },
          });
        },
      );

      const service = new DictionaryService({
        dataDir: tempDir,
        downloadUrl: `http://127.0.0.1:${server.addr.port}/download`,
      });

      try {
        await service.initialize();
        let search = searchEntries(service.db, {
          query: "처음말",
          match: "exact",
        });
        assertEquals(search.total, 1);

        version = 2;
        const status = await service.refresh();
        assertEquals(status.source_date, "2026-04-01");

        search = searchEntries(service.db, { query: "나중말", match: "exact" });
        assertEquals(search.total, 1);
        assertEquals(search.items[0].word, "나중말");
      } finally {
        service.close();
      }
    } finally {
      abortController.abort();
      await server?.finished.catch(() => undefined);
      await Deno.remove(tempDir, { recursive: true });
    }
  },
});
