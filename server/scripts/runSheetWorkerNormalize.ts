import { access } from "node:fs/promises";
import type { RunSheetImportParserType } from "../schema";
import {
  cleanString,
  parseAndNormalizeCompetitionRunSheetPdf,
  resolveSingleRunSheetParserVendor,
} from "../run-sheet-import";

type CliArgs = {
  pdfPath: string;
  providerKey: string;
  parserType: RunSheetImportParserType;
};

const allowedParserTypes = new Set<RunSheetImportParserType>([
  "AUTO",
  "WCDE",
  "VELOCITY",
  "HOLLYWOOD_VIBE",
  "NYCDA",
  "UNKNOWN",
]);

function readFlag(argv: string[], flag: string): string {
  const index = argv.indexOf(flag);
  if (index < 0 || index === argv.length - 1) {
    throw new Error(`Missing required flag ${flag}.`);
  }

  return argv[index + 1];
}

async function parseCliArgs(argv: string[]): Promise<CliArgs> {
  const pdfPath = cleanString(readFlag(argv, "--pdf"));
  const providerKey = cleanString(readFlag(argv, "--provider-key"));
  const parserTypeRaw = cleanString(argv.includes("--parser-type") ? readFlag(argv, "--parser-type") : "AUTO").toUpperCase();

  if (!pdfPath) {
    throw new Error("--pdf is required.");
  }

  if (!providerKey) {
    throw new Error("--provider-key is required.");
  }

  await access(pdfPath);

  if (!allowedParserTypes.has(parserTypeRaw as RunSheetImportParserType)) {
    throw new Error(`Unsupported parser type ${parserTypeRaw}.`);
  }

  return {
    pdfPath,
    providerKey,
    parserType: parserTypeRaw as RunSheetImportParserType,
  };
}

async function main(): Promise<void> {
  const args = await parseCliArgs(process.argv.slice(2));
  const parserVendor = resolveSingleRunSheetParserVendor(args.providerKey, args.parserType);
  const entries = await parseAndNormalizeCompetitionRunSheetPdf(args.pdfPath, parserVendor);

  process.stdout.write(JSON.stringify({
    parserVendor,
    parserType: args.parserType,
    entryCount: entries.length,
    entries,
  }));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
