import sys
import os
import re
import pdfplumber
import pandas as pd


TIME_RE = re.compile(
    r"^\d{1,2}:\d{2}(?:\s*(AM|PM))?(?:\s*-\s*\d{1,2}:\d{2}(?:\s*(AM|PM))?)?$",
    re.IGNORECASE,
)


def clean_cell(value):
    """Normalize a cell to a single-line, trimmed string."""
    if value is None:
        return ""
    text = str(value)
    # Keep spaces but remove newlines and collapse whitespace
    text = text.replace("\n", " ")
    text = " ".join(text.split())
    return text.strip()


def looks_like_time(text: str) -> bool:
    text = clean_cell(text)
    return bool(TIME_RE.match(text))


def parse_velocity_comp(pdf_path: str) -> pd.DataFrame:
    """
    Parse a Velocity competition schedule into a DataFrame.

    Expected columns per data row (based on the Concord PDF):
    Time | Entry # | Routine Name | Category | Studio | Performer(s)

    We:
    - Walk all tables on all pages.
    - Treat rows as data if column 1 is a time and column 2 is an integer.
    - Ignore judge breaks, awards lines, etc.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    records = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            if not tables:
                continue

            for table_index, table in enumerate(tables, start=1):
                if not table or len(table) < 2:
                    continue

                for raw_row in table:
                    if not raw_row or not any(raw_row):
                        continue

                    cells = [clean_cell(c) for c in raw_row]

                    # We expect at least: time, entry_num, dance_name, category
                    if len(cells) < 4:
                        continue

                    time_txt = cells[0]
                    entry_txt = cells[1]

                    # Filter to "real" competition rows
                    if not looks_like_time(time_txt):
                        continue
                    if not entry_txt.isdigit():
                        continue

                    dance_name = cells[2] if len(cells) > 2 else ""
                    category = cells[3] if len(cells) > 3 else ""
                    studio = cells[4] if len(cells) > 4 else ""
                    performers = cells[5] if len(cells) > 5 else ""

                    records.append(
                        {
                            "page": page_index,
                            "time": time_txt,
                            "entry_num": entry_txt,
                            "dance_name": dance_name,
                            "category": category,
                            "studio": studio,
                            "performers": performers,
                            "raw_row": " | ".join(cells),
                        }
                    )

    if not records:
        raise ValueError(
            "No Velocity competition rows detected. "
            "Check that the PDF is the full competition schedule and that the layout matches Concord."
        )

    df = pd.DataFrame(records)

    # Enforce column order
    cols = [
        "time",
        "entry_num",
        "dance_name",
        "category",
        "studio",
        "performers",
        "page",
        "raw_row",
    ]
    existing = [c for c in cols if c in df.columns]
    others = [c for c in df.columns if c not in existing]
    df = df[existing + others]

    return df


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_velocity_comp.py 'VELOCITY_Full-Concord-Comp-Schedule.pdf'")
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        df = parse_velocity_comp(pdf_path)
    except Exception as e:
        print(f"Error while parsing Velocity competition schedule: {e}")
        sys.exit(1)

    base_dir = os.path.dirname(os.path.abspath(pdf_path))
    out_path = os.path.join(base_dir, "velocity_competition_parsed.csv")
    df.to_csv(out_path, index=False, encoding="utf-8-sig")

    print(f"Parsed {len(df)} rows. Saved CSV to: {out_path}")


if __name__ == "__main__":
    main()
