import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import type { FileEntry } from "@zip.js/zip.js";
import type { RawDictionaryFile } from "../types.ts";

export async function* iterateDumpItems(
  zipPath: string,
): AsyncGenerator<unknown> {
  const bytes = await Deno.readFile(zipPath);
  const blob = new Blob([bytes], { type: "application/zip" });
  const reader = new ZipReader(new BlobReader(blob));

  try {
    const entries = await reader.getEntries();
    const files = entries
      .filter(
        (entry): entry is FileEntry =>
          !entry.directory &&
          entry.filename.endsWith(".json") &&
          "getData" in entry,
      )
      .sort((a, b) => a.filename.localeCompare(b.filename, "en"));

    for (const entry of files) {
      const text = await entry.getData(new TextWriter());
      const parsed = JSON.parse(text) as RawDictionaryFile;
      const items = parsed.channel?.item;

      if (Array.isArray(items)) {
        for (const item of items) {
          yield item;
        }
      } else if (items) {
        yield items;
      }
    }
  } finally {
    await reader.close();
  }
}
