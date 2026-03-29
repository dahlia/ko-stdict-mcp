import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import {
  DEFAULT_DOWNLOAD_URL,
  DEFAULT_JSON_LINK_KEY,
  DEFAULT_USER_AGENT,
} from "../config.ts";
import type { DownloadInfo, DownloadOptions, StateFile } from "../types.ts";
import {
  decodeContentDispositionFilename,
  extractSourceDate,
} from "../utils.ts";

export async function readState(path: string): Promise<StateFile | null> {
  try {
    const text = await Deno.readTextFile(path);
    return JSON.parse(text) as StateFile;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw error;
  }
}

export async function writeState(
  path: string,
  state: StateFile,
): Promise<void> {
  await Deno.writeTextFile(path, JSON.stringify(state, null, 2));
}

export async function ensureDownload(
  options: Partial<DownloadOptions> & {
    force?: boolean;
    paths: DownloadOptions["paths"];
  },
): Promise<DownloadInfo> {
  const downloadUrl = options.downloadUrl ?? DEFAULT_DOWNLOAD_URL;
  const jsonLinkKey = options.jsonLinkKey ?? DEFAULT_JSON_LINK_KEY;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const force = options.force ?? false;
  const state = await readState(options.paths.statePath);

  const current = state?.current_download;
  if (!force && current) {
    try {
      await Deno.stat(current.zipPath);
      return current;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }

  await ensureDir(options.paths.downloadsDir);

  const form = new FormData();
  form.set("link_key", jsonLinkKey);
  form.set("pageUnit", "10");
  form.set("pageIndex", "1");

  const response = await fetch(downloadUrl, {
    method: "POST",
    headers: {
      "user-agent": userAgent,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download dictionary dump: HTTP ${response.status}`,
    );
  }

  const sourceFilename = decodeContentDispositionFilename(
    response.headers.get("content-disposition"),
  ) ?? `stdict_${jsonLinkKey}.zip`;

  const zipPath = join(options.paths.downloadsDir, sourceFilename);
  const tempPath = `${zipPath}.download`;
  const body = response.body;
  if (!body) {
    throw new Error("Dictionary dump response did not include a body.");
  }

  const file = await Deno.open(tempPath, {
    create: true,
    write: true,
    truncate: true,
  });
  await body.pipeTo(file.writable);

  await Deno.rename(tempPath, zipPath);

  const downloadInfo: DownloadInfo = {
    zipPath,
    sourceFilename,
    sourceDate: extractSourceDate(sourceFilename),
    downloadedAt: new Date().toISOString(),
  };

  await writeState(options.paths.statePath, {
    schema_version: state?.schema_version ?? 0,
    current_download: downloadInfo,
  });

  return downloadInfo;
}
