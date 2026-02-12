import os
import re
import sys

import pandas as pd
import pdfplumber


ROUTINE_HEADER_1 = "Routine Name Category # Dancers"
ROUTINE_HEADER_2 = "Dancers"

DIVISION_PATTERN = r"(Mini|Pre-Teen|Junior|Teen|Senior)"
GROUP_PATTERN = r"(Solo|Duo/Trio|Small Group|Large Group|Line|Production)"
ROUTINE_LINE_RE = re.compile(
    rf"^(?P<name>.+?)\s+{DIVISION_PATTERN}\s+{GROUP_PATTERN}\s+(?P<style>.+)$"
)


def clean_line(value):
    if value is None:
        return ""
    text = str(value)
    text = text.replace("\r", " ").replace("\n", " ")
    text = " ".join(text.split())
    return text.strip()


def parse_segment_header(line):
    """
    Example:
    '3/7/2025 Stage 1 - JUNIOR & TEEN SOLO COMPETITION Fri 7:00 AM - 12:00 PM'
    """
    parts = line.split()
    if not parts:
        return "", "", line

    date = parts[0]
    stage = ""
    if len(parts) >= 3 and parts[1].lower() == "stage":
        stage = parts[2].strip()
    return date, stage, line


def parse_routine_line(line):
    """
    'No Excuses Junior Solo Jazz'
    -> routine_name, division, group_size, style
    """
    m = ROUTINE_LINE_RE.match(line)
    if not m:
        return line, "", "", ""

    name = m.group("name").strip()
    division = m.group(2).strip()
    group_size = m.group(3).strip()
    style = m.group("style").strip()
    return name, division, group_size, style


def parse_hollywood_vibe_comp(pdf_path: str) -> pd.DataFrame:
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    records = []

    studio_name = ""
    current_segment_date = ""
    current_stage = ""
    current_segment_line = ""

    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            raw_lines = text.splitlines()
            lines = [clean_line(line) for line in raw_lines if clean_line(line)]

            # Studio name often appears directly under "Hollywood Vibe" on first page.
            if page_index == 1:
                for i, line in enumerate(lines):
                    if line == "Hollywood Vibe" and i + 1 < len(lines):
                        studio_name = lines[i + 1]
                        break

            # Track latest segment header encountered on this page.
            for line in lines:
                if re.match(r"^\d{1,2}/\d{1,2}/\d{4} Stage ", line):
                    (
                        current_segment_date,
                        current_stage,
                        current_segment_line,
                    ) = parse_segment_header(line)

            # Find routine blocks by header markers.
            for idx, line in enumerate(lines):
                if (
                    line == ROUTINE_HEADER_1
                    and idx + 1 < len(lines)
                    and lines[idx + 1] == ROUTINE_HEADER_2
                ):
                    # Need lines before/after this header in fixed offsets.
                    if idx - 3 < 0 or idx + 9 >= len(lines):
                        continue

                    routine_line = lines[idx - 3]
                    num_dancers_line = lines[idx - 2]
                    dancers_line = lines[idx - 1]

                    entry_num_line = lines[idx + 2]
                    perf_time_line = lines[idx + 7]
                    choreographer_line = lines[idx + 9]

                    routine_name, division, group_size, style = parse_routine_line(
                        routine_line
                    )

                    try:
                        num_dancers = int(num_dancers_line)
                    except ValueError:
                        num_dancers = None

                    records.append(
                        {
                            "page": page_index,
                            "segment_date": current_segment_date,
                            "segment_stage": current_stage,
                            "segment_header": current_segment_line,
                            "studio": studio_name,
                            "entry_num": entry_num_line,
                            # Keep both naming variants so downstream mappers can reuse shared logic.
                            "routine_name": routine_name,
                            "dance_name": routine_name,
                            "division": division,
                            "group_size": group_size,
                            "style": style,
                            "num_dancers": num_dancers,
                            "dancers": dancers_line,
                            "perf_datetime": perf_time_line,
                            "time": perf_time_line,
                            "choreographer": choreographer_line,
                        }
                    )

    if not records:
        raise ValueError(
            "No Hollywood Vibe routine blocks found. "
            "Check that the PDF matches the expected studio schedule format."
        )

    df = pd.DataFrame(records)

    cols = [
        "entry_num",
        "routine_name",
        "dance_name",
        "division",
        "group_size",
        "style",
        "num_dancers",
        "dancers",
        "perf_datetime",
        "time",
        "choreographer",
        "segment_date",
        "segment_stage",
        "segment_header",
        "studio",
        "page",
    ]
    existing = [c for c in cols if c in df.columns]
    others = [c for c in df.columns if c not in existing]
    return df[existing + others]


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: python parse_hollywood_vibe_comp.py "
            "'final Hollywood vibe 2025.pdf'"
        )
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        df = parse_hollywood_vibe_comp(pdf_path)
    except Exception as e:
        print(f"Error while parsing Hollywood Vibe competition schedule: {e}")
        sys.exit(1)

    base_dir = os.path.dirname(os.path.abspath(pdf_path))
    out_path = os.path.join(base_dir, "hollywood_vibe_competition_parsed.csv")
    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"Parsed {len(df)} rows. Saved CSV to: {out_path}")


if __name__ == "__main__":
    main()
