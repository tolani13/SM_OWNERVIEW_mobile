import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { RunSheetImportParserType } from "./schema";
import {
  normalizePythonCompetitionRows,
  type PythonCompetitionParserVendor,
  type PythonParsedCompetitionRow,
} from "./utils/runSheetNormalizer";

type ConcreteRunSheetImportParserType = Extract<
  RunSheetImportParserType,
  "WCDE" | "VELOCITY" | "HOLLYWOOD_VIBE"
>;

export const RUN_SHEET_PARSER_CONFIG: Record<
  PythonCompetitionParserVendor,
  {
    scriptPath: string;
    functionName: string;
    tempPrefix: string;
    companyLabel: string;
    parserType: ConcreteRunSheetImportParserType;
  }
> = {
  wcde: {
    scriptPath: "parse_wcde_comp.py",
    functionName: "parse_wcde_comp",
    tempPrefix: "wcde-run-sheet-",
    companyLabel: "WCDE",
    parserType: "WCDE",
  },
  velocity: {
    scriptPath: "parse_velocity_comp.py",
    functionName: "parse_velocity_comp",
    tempPrefix: "velocity-run-sheet-",
    companyLabel: "Velocity",
    parserType: "VELOCITY",
  },
  hollywood_vibe: {
    scriptPath: "parse_hollywood_vibe_comp.py",
    functionName: "parse_hollywood_vibe_comp",
    tempPrefix: "hollywood-vibe-run-sheet-",
    companyLabel: "Hollywood Vibe",
    parserType: "HOLLYWOOD_VIBE",
  },
};

export function cleanString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

export function detectRunSheetParserVendor(
  competitionName: string,
  originalFileName = "",
): PythonCompetitionParserVendor {
  const normalizedCompetition = cleanString(competitionName).toLowerCase();
  const normalizedFileName = cleanString(originalFileName).toLowerCase();

  const isHollywoodVibe =
    normalizedCompetition.includes("hollywood vibe") ||
    normalizedCompetition.includes("hollywoodvibe") ||
    ((normalizedCompetition.includes("hollywood") || normalizedFileName.includes("hollywood")) &&
      (normalizedCompetition.includes("vibe") || normalizedFileName.includes("vibe")));

  if (isHollywoodVibe) {
    return "hollywood_vibe";
  }

  if (
    normalizedCompetition.includes("velocity") ||
    normalizedFileName.includes("velocity") ||
    normalizedFileName.includes("concord")
  ) {
    return "velocity";
  }

  return "wcde";
}

export function resolveRunSheetParserOverride(
  raw: unknown,
): PythonCompetitionParserVendor | null {
  const normalized = cleanString(raw).toLowerCase();
  const compact = normalized.replace(/[\s_-]+/g, "");

  if (normalized === "velocity") return "velocity";
  if (normalized === "wcde") return "wcde";
  if (
    normalized === "hollywood_vibe" ||
    normalized === "hollywood-vibe" ||
    normalized === "hollywood vibe" ||
    normalized === "hollywoodvibe" ||
    normalized === "hollywood" ||
    compact === "hollywoodvibe"
  ) {
    return "hollywood_vibe";
  }

  return null;
}

export function getRunSheetParserCandidates(
  competitionName: string,
  originalFileName: string,
  parserOverride: PythonCompetitionParserVendor | null,
): PythonCompetitionParserVendor[] {
  if (parserOverride) return [parserOverride];

  const detected = detectRunSheetParserVendor(competitionName, originalFileName);
  const fallbackOrder: PythonCompetitionParserVendor[] =
    detected === "hollywood_vibe"
      ? ["hollywood_vibe", "wcde", "velocity"]
      : detected === "velocity"
        ? ["velocity", "wcde", "hollywood_vibe"]
        : ["wcde", "velocity", "hollywood_vibe"];

  return fallbackOrder;
}

export function mapParserVendorToParserType(
  parserVendor: PythonCompetitionParserVendor,
): ConcreteRunSheetImportParserType {
  return RUN_SHEET_PARSER_CONFIG[parserVendor].parserType;
}

export function resolveSingleRunSheetParserVendor(
  providerKey: string,
  parserType: RunSheetImportParserType,
): PythonCompetitionParserVendor {
  if (parserType === "WCDE") return "wcde";
  if (parserType === "VELOCITY") return "velocity";
  if (parserType === "HOLLYWOOD_VIBE") return "hollywood_vibe";

  const normalizedProviderKey = cleanString(providerKey).toLowerCase();
  if (normalizedProviderKey === "wcde") return "wcde";
  if (normalizedProviderKey === "velocity") return "velocity";
  if (
    normalizedProviderKey === "hollywood_vibe" ||
    normalizedProviderKey === "hollywood-vibe" ||
    normalizedProviderKey === "hollywood vibe" ||
    normalizedProviderKey === "hollywoodvibe"
  ) {
    return "hollywood_vibe";
  }

  throw new Error(
    `Unsupported run-sheet parser selection provider_key=${providerKey} parser_type=${parserType}.`,
  );
}

function runPython(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("python", args, {
      cwd: process.cwd(),
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start Python: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const details = (stderr || stdout).trim();
      reject(new Error(details || `Python exited with code ${code}`));
    });
  });
}

export async function parseCompetitionRunSheetPdf(
  pdfPath: string,
  parserVendor: PythonCompetitionParserVendor,
): Promise<PythonParsedCompetitionRow[]> {
  const parserConfig = RUN_SHEET_PARSER_CONFIG[parserVendor];
  const parserScriptPath = path.join(process.cwd(), parserConfig.scriptPath);

  try {
    await fs.access(parserScriptPath);
  } catch {
    throw new Error(`Python parser script ${parserConfig.scriptPath} was not found in the project root.`);
  }

  const moduleName = path.parse(parserConfig.scriptPath).name;
  const pythonCode = [
    "import sys",
    `from ${moduleName} import ${parserConfig.functionName}`,
    `df = ${parserConfig.functionName}(sys.argv[1]).fillna('')`,
    "print(df.to_json(orient='records'))",
  ].join("\n");

  const { stdout } = await runPython(["-c", pythonCode, pdfPath]);
  const output = stdout.trim();

  if (!output) {
    throw new Error("Python parser returned no output.");
  }

  let parsedRows: PythonParsedCompetitionRow[] = [];
  try {
    const json = JSON.parse(output);
    if (!Array.isArray(json)) {
      throw new Error("Parser output is not an array.");
    }
    parsedRows = json as PythonParsedCompetitionRow[];
  } catch (error) {
    throw new Error(`Failed to parse Python output as JSON: ${(error as Error).message}`);
  }

  return parsedRows;
}

export async function parseAndNormalizeCompetitionRunSheetPdf(
  pdfPath: string,
  parserVendor: PythonCompetitionParserVendor,
) {
  const parsedRows = await parseCompetitionRunSheetPdf(pdfPath, parserVendor);
  return normalizePythonCompetitionRows(parsedRows, parserVendor);
}
