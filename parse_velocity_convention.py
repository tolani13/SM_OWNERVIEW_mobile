import sys
import os
import pdfplumber
import pandas as pd


def clean_cell_basic(value):
    """Simple cleaner for header/time cells."""
    if value is None:
        return ""
    text = str(value)
    text = text.replace("\n", " ")
    text = " ".join(text.split())
    return text.strip()


def clean_class_cell(value):
    """
    For class cells, preserve line breaks as ' | ' so we can split:
    'WARM-UP /BALLET\\nMELISSA SANDVIG' -> 'WARM-UP /BALLET | MELISSA SANDVIG'
    """
    if value is None:
        return ""
    text = str(value)
    text = text.replace("\n", " | ")
    text = " ".join(text.split())
    return text.strip()


def split_style_teacher(cell: str):
    """
    Heuristic: first segment(s) = style/description, last segment = teacher.
    Example: 'WARM-UP /BALLET | MELISSA SANDVIG' ->
             style='WARM-UP /BALLET', teacher='MELISSA SANDVIG'
    """
    cell = cell.strip()
    if not cell:
        return "", ""
    parts = [p.strip() for p in cell.split("|") if p.strip()]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    style = " | ".join(parts[:-1])
    teacher = parts[-1]
    return style, teacher


def detect_day(text: str) -> str:
    text_up = text.upper()
    if "SATURDAY" in text_up:
        return "Saturday"
    if "SUNDAY" in text_up:
        return "Sunday"
    if "FRIDAY" in text_up:
        return "Friday"
    return ""


def parse_velocity_convention(pdf_path: str) -> pd.DataFrame:
    """
    Parse Velocity convention attendee PDF into:
    day, time, track, style, teacher, class_raw
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    records = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            page_text = page.extract_text() or ""
            day = detect_day(page_text)

            tables = page.extract_tables()
            if not tables:
                continue

            for table_index, table in enumerate(tables, start=1):
                if not table or len(table) < 2:
                    continue

                raw_header = table[0]
                header = [clean_cell_basic(h) for h in raw_header]

                # Heuristic: convention grid tables have 'MINI' and 'JUNIOR' etc in header
                header_up = [h.upper() for h in header]
                if not ("MINI" in " ".join(header_up) and "JUNIOR" in " ".join(header_up)):
                    # probably not the main schedule grid (could be the Friday block)
                    continue

                # Column 0 is time; the rest are age tracks.
                for row in table[1:]:
                    if not row or not any(row):
                        continue

                    time_val = clean_cell_basic(row[0] if len(row) > 0 else "")
                    if not time_val:
                        continue

                    for col_idx in range(1, len(header)):
                        track = header[col_idx]
                        if not track:
                            continue

                        cell_raw = row[col_idx] if col_idx < len(row) else None
                        cell = clean_class_cell(cell_raw)
                        if not cell:
                            continue

                        style, teacher = split_style_teacher(cell)

                        records.append(
                            {
                                "page": page_index,
                                "day": day,
                                "time": time_val,
                                "track": track,
                                "style": style,
                                "teacher": teacher,
                                "class_raw": cell,
                            }
                        )

    if not records:
        raise ValueError(
            "No Velocity convention schedule grid found. "
            "Check that the PDF is the attendee schedule with MINI/JUNIOR/INTERMEDIATE grid."
        )

    df = pd.DataFrame(records)

    # Consistent column order
    cols = ["day", "time", "track", "style", "teacher", "class_raw", "page"]
    existing = [c for c in cols if c in df.columns]
    others = [c for c in df.columns if c not in existing]
    df = df[existing + others]

    return df


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_velocity_convention.py 'VELOCITY_CONVENTION_CONCORD-2026-Attendee-PDF-FINAL.pdf'")
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        df = parse_velocity_convention(pdf_path)
    except Exception as e:
        print(f"Error while parsing Velocity convention schedule: {e}")
        sys.exit(1)

    base_dir = os.path.dirname(os.path.abspath(pdf_path))
    out_path = os.path.join(base_dir, "velocity_convention_parsed.csv")
    df.to_csv(out_path, index=False, encoding="utf-8-sig")

    print(f"Parsed {len(df)} rows. Saved CSV to: {out_path}")


if __name__ == "__main__":
    main()
