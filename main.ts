import { runStdioServer } from "./src/mcp/server.ts";
import { DictionaryService } from "./src/dictionary.ts";

function parseArgs(args: string[]) {
  return {
    initOnly: args.includes("--init-only"),
    refresh: args.includes("--refresh"),
    dataDir: getValueAfterFlag(args, "--data-dir"),
  };
}

function getValueAfterFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);
  const options = {
    dataDir: args.dataDir,
  };

  if (args.initOnly || args.refresh) {
    const dictionary = new DictionaryService(options);
    try {
      if (args.refresh) {
        await dictionary.initialize();
        const status = await dictionary.refresh();
        console.log(JSON.stringify(status, null, 2));
      } else {
        const status = await dictionary.initialize();
        console.log(JSON.stringify(status, null, 2));
      }
    } finally {
      dictionary.close();
    }
    return;
  }

  await runStdioServer(options);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    Deno.exit(1);
  });
}
