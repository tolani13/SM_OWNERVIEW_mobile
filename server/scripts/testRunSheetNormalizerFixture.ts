import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  normalizePythonCompetitionRows,
  type PythonParsedCompetitionRow,
} from "../utils/runSheetNormalizer";
import fixture from "../../fixtures/run-sheet/wcde_biloxi_style_groupSize_fixture.json";

type FixtureAssertion = {
  entryNumber: string;
  style: string;
  groupSize: string;
};

type FixtureShape = {
  pdfPath: string;
  expectedRowCount: number;
  assertions: FixtureAssertion[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function runPythonParse(pdfPath: string): PythonParsedCompetitionRow[] {
  const pyCode =
    "import json,sys;from parse_wcde_comp import parse_wcde_comp;df=parse_wcde_comp(sys.argv[1]).fillna('');print(df.to_json(orient='records'))";

  const result = spawnSync("python", ["-c", pyCode, pdfPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Python parse failed").trim());
  }

  const output = (result.stdout || "").trim();
  assert(output, "Python parse produced empty output");
  const parsed = JSON.parse(output);
  assert(Array.isArray(parsed), "Python parse output is not an array");

  return parsed as PythonParsedCompetitionRow[];
}

function asEntrySet(
  rows: Array<{ entry_num?: string }> | Array<{ entryNumber?: string }> | Array<Record<string, unknown>>,
): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const key = String(record.entry_num ?? record.entryNumber ?? "").trim();
    if (/^\d+$/.test(key)) set.add(key);
  }
  return set;
}

function main(): void {
  const f = fixture as FixtureShape;
  const pdfPath = path.resolve(process.cwd(), f.pdfPath);
  assert(fs.existsSync(pdfPath), `Fixture PDF does not exist: ${pdfPath}`);

  const pythonRows = runPythonParse(pdfPath);
  const normalizedRows = normalizePythonCompetitionRows(pythonRows, "wcde");

  assert(
    normalizedRows.length === f.expectedRowCount,
    `Expected ${f.expectedRowCount} normalized rows, got ${normalizedRows.length}`,
  );

  const pythonKeys = asEntrySet(pythonRows);
  const normalizedKeys = asEntrySet(normalizedRows);

  assert(
    pythonKeys.size === normalizedKeys.size,
    `Entry key set size mismatch (python=${pythonKeys.size}, normalized=${normalizedKeys.size})`,
  );

  for (const key of pythonKeys) {
    assert(normalizedKeys.has(key), `Normalized keys missing entry ${key}`);
  }

  const byEntry = new Map(normalizedRows.map((row) => [String(row.entryNumber), row]));

  for (const expected of f.assertions) {
    const row = byEntry.get(expected.entryNumber);
    assert(row, `Missing normalized row for entry ${expected.entryNumber}`);
    assert(
      String(row.style ?? "") === expected.style,
      `Entry ${expected.entryNumber} style mismatch (expected='${expected.style}', got='${row.style ?? ""}')`,
    );
    assert(
      String(row.groupSize ?? "") === expected.groupSize,
      `Entry ${expected.entryNumber} groupSize mismatch (expected='${expected.groupSize}', got='${row.groupSize ?? ""}')`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        expectedRowCount: f.expectedRowCount,
        normalizedRowCount: normalizedRows.length,
        pythonKeyCount: pythonKeys.size,
        normalizedKeyCount: normalizedKeys.size,
        assertedEntries: f.assertions.length,
      },
      null,
      2,
    ),
  );
}

main();
