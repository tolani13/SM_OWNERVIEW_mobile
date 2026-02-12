import fs from "node:fs/promises";
import path from "node:path";
import { extractCompetitionInfo } from "../utils/competitionPdfParser";

async function main(): Promise<void> {
  const pdfPathArg = process.argv[2];

  if (!pdfPathArg) {
    console.error(
      "Usage: node dist/server/scripts/testCompetitionPdfParser.js <path/to/file.pdf>",
    );
    process.exitCode = 1;
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), pdfPathArg);
  const pdfBuffer = await fs.readFile(resolvedPath);
  const result = await extractCompetitionInfo(pdfBuffer);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Failed to parse competition PDF:", error);
  process.exitCode = 1;
});
