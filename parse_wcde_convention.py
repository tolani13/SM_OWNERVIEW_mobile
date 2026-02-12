import re
import sys
from typing import Optional

import pandas as pd
import pdfplumber


DIVISION_COLUMNS = ["MINI", "JUNIOR", "TEEN/SENIOR", "BREAKOUT"]


def infer_day_from_page_text(page_text: str) -> str:
    text = clean_text(page_text).lower()
    if "sunday class schedule" in text:
        return "Sunday"
    if "saturday class schedule" in text:
        return "Saturday"
    if "friday class schedule" in text:
        return "Friday"
    return "Saturday"


def infer_day_for_time(page_day: str, start_time: str) -> str:
    """
    Biloxi layout has Saturday and Sunday grids on the same page.
    Use a practical cutoff based on observed schedule:
    - early blocks belong to Saturday
    - later blocks belong to Sunday
    """
    if page_day in ("Sunday", "Friday"):
        return page_day

    m = re.match(r"^(\d{1,2}):(\d{2})$", clean_text(start_time))
    if not m:
        return page_day
    hour = int(m.group(1))
    minute = int(m.group(2))

    # 7:30-12:30 on page-1 table 0 is Saturday; page-1 table 1 starts at 7:30 too.
    # Distinguish by sequence in parser using explicit table section day where available.
    # If ambiguous fallback: keep page day.
    _ = minute  # silence lint for now
    return page_day


def infer_day_from_table_rows(rows) -> Optional[str]:
    for r in rows:
        joined = " ".join(clean_text(c) for c in (r or []) if clean_text(c))
        low = joined.lower()
        if "sunday class schedule" in low:
            return "Sunday"
        if "saturday class schedule" in low:
            return "Saturday"
        if "friday class schedule" in low:
            return "Friday"
    return None


def clean_text(value) -> str:
    if value is None:
        return ""
    text = str(value).replace("\n", " ")
    return " ".join(text.split()).strip()


def normalize_division(label: str) -> str:
    raw = clean_text(label).upper()
    if "TEEN" in raw and "SENIOR" in raw:
        return "Teen/Senior"
    if "MINI" in raw:
        return "Mini"
    if "JUNIOR" in raw:
        return "Junior"
    if "BREAKOUT" in raw:
        return "Breakout"
    return clean_text(label)


def parse_time_range(value: str):
    text = clean_text(value)
    m = re.match(r"^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$", text)
    if not m:
        return None, None
    return m.group(1), m.group(2)


def infer_style(class_name: str) -> str:
    lower = clean_text(class_name).lower()
    if "hip-hop" in lower or "hip hop" in lower:
        return "Hip Hop"
    if "contemp" in lower:
        return "Contemporary"
    if "lyric" in lower:
        return "Lyrical"
    if "jazz" in lower:
        return "Jazz"
    if "tap" in lower:
        return "Tap"
    if "ballet" in lower:
        return "Ballet"
    if "acro" in lower:
        return "Acro"
    if "floorwork" in lower:
        return "Open"
    if "audition" in lower:
        return "Audition"
    if "battle" in lower:
        return "Hip Hop"
    return ""


def split_class_and_instructor(cell_text: str):
    text = clean_text(cell_text)
    if not text:
        return "", ""

    # Typical shape: "Ballet | Tiffany Billings"
    if "|" in text:
        left, right = text.split("|", 1)
        return clean_text(left), clean_text(right)

    # Sometimes breakout row shortens to "Advanced Tap | Bowman"
    return text, ""


def is_noise_cell(text: str) -> bool:
    if not text:
        return True
    upper = text.upper()
    noise_tokens = [
        "CLASS BREAK",
        "LUNCH BREAK",
        "TEACHER MEETING",
        "WAKE UP WITH WEST COAST",
        "DRESSING ROOMS OPEN",
        "WEEKEND WRAP UP",
        "FACULTY PERFORMANCE",
        "SCHOLARSHIP AWARDS",
        "COMPETITION STARTS",
    ]
    return any(token in upper for token in noise_tokens)


def parse_grid_tables(pdf_path: str):
    records = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            page_text = page.extract_text() or ""
            default_page_day = infer_day_from_page_text(page_text)
            tables = page.extract_tables() or []

            for table_index, table in enumerate(tables):
                if not table or len(table) < 2:
                    continue

                header = [clean_text(c) for c in table[0]]
                normalized_header = [h.upper() for h in header]

                # We want the main schedule grid tables:
                # ['', 'MINI', 'JUNIOR', 'TEEN/SENIOR', 'BREAKOUT']
                if len(normalized_header) < 5:
                    continue
                if not all(col in normalized_header for col in DIVISION_COLUMNS):
                    continue

                explicit_day = infer_day_from_table_rows(table[:2])
                if explicit_day:
                    table_day = explicit_day
                else:
                    # Biloxi specific: first schedule grid on page 1 is Saturday, second is Sunday.
                    if page_index == 1 and table_index == 0:
                        table_day = "Saturday"
                    elif page_index == 1 and table_index == 1:
                        table_day = "Sunday"
                    else:
                        table_day = default_page_day

                col_index = {clean_text(h).upper(): i for i, h in enumerate(header)}
                mini_i = col_index.get("MINI")
                junior_i = col_index.get("JUNIOR")
                teen_i = col_index.get("TEEN/SENIOR")
                breakout_i = col_index.get("BREAKOUT")

                for row in table[1:]:
                    if not row:
                        continue

                    time_cell = clean_text(row[0] if len(row) > 0 else "")
                    start_time, end_time = parse_time_range(time_cell)
                    if not start_time:
                        continue

                    row_map = {
                        "Mini": clean_text(row[mini_i]) if mini_i is not None and mini_i < len(row) else "",
                        "Junior": clean_text(row[junior_i]) if junior_i is not None and junior_i < len(row) else "",
                        "Teen/Senior": clean_text(row[teen_i]) if teen_i is not None and teen_i < len(row) else "",
                        "Breakout": clean_text(row[breakout_i]) if breakout_i is not None and breakout_i < len(row) else "",
                    }

                    for division, cell in row_map.items():
                        if is_noise_cell(cell):
                            continue

                        class_name, instructor = split_class_and_instructor(cell)
                        if not class_name:
                            continue

                        records.append(
                            {
                                "class_name": class_name,
                                "instructor": instructor,
                                "room": "Breakout Ballroom" if division == "Breakout" else division,
                                "day": infer_day_for_time(table_day, start_time),
                                "start_time": start_time,
                                "end_time": end_time,
                                "duration": 0,
                                "style": infer_style(class_name),
                                "division": normalize_division(division),
                                "age_range": "",
                                "level": "All Levels",
                                "is_audition_phrase": "audition" in class_name.lower(),
                                "raw_text": cell,
                            }
                        )

    return records


def parse_breakout_description_tables(pdf_path: str):
    records = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            page_day = infer_day_from_page_text(page_text)
            tables = page.extract_tables() or []
            breakout_section_index = 0
            for table in tables:
                if not table or len(table) < 2:
                    continue

                header = [clean_text(c).upper() for c in table[0]]
                if "CLASS" not in header or "DESCRIPTION" not in header:
                    continue

                table_day = page_day
                if page_day == "Saturday":
                    # Biloxi breakout page includes Saturday then Sunday sections.
                    table_day = "Saturday" if breakout_section_index == 0 else "Sunday"
                breakout_section_index += 1

                for row in table[1:]:
                    if not row or len(row) < 3:
                        continue

                    time_cell = clean_text(row[0])
                    class_cell = clean_text(row[1])
                    desc_cell = clean_text(row[2])

                    start_time, end_time = parse_time_range(time_cell)
                    if not start_time:
                        continue

                    # class cell looks like: "Battle Rock — Gev Manoukian —"
                    normalized = class_cell.replace("—", "|")
                    parts = [clean_text(p) for p in normalized.split("|") if clean_text(p)]
                    class_name = parts[0] if parts else class_cell
                    instructor = parts[1] if len(parts) > 1 else ""

                    records.append(
                        {
                            "class_name": class_name,
                            "instructor": instructor,
                            "room": "Breakout Ballroom",
                            "day": table_day,
                            "start_time": start_time,
                            "end_time": end_time,
                            "duration": 0,
                            "style": infer_style(class_name),
                            "division": "Breakout",
                            "age_range": "",
                            "level": "All Levels",
                            "is_audition_phrase": "audition" in class_name.lower(),
                            "raw_text": f"{class_cell} {desc_cell}".strip(),
                        }
                    )

    return records


def add_duration_and_dedupe(records):
    normalized = []
    seen = set()

    for r in records:
        start = clean_text(r.get("start_time", ""))
        end = clean_text(r.get("end_time", ""))

        duration = None
        tm = re.match(r"^(\d{1,2}):(\d{2})$", start)
        em = re.match(r"^(\d{1,2}):(\d{2})$", end)
        if tm and em:
            sh, sm = int(tm.group(1)), int(tm.group(2))
            eh, emn = int(em.group(1)), int(em.group(2))
            duration = (eh * 60 + emn) - (sh * 60 + sm)
            if duration <= 0:
                duration += 12 * 60

        row = {
            "class_name": clean_text(r.get("class_name", "")),
            "instructor": clean_text(r.get("instructor", "")) or "TBD",
            "room": clean_text(r.get("room", "")) or "Main Ballroom",
            "day": clean_text(r.get("day", "")) or "Saturday",
            "start_time": start,
            "end_time": end,
            "duration": duration if duration is not None else "",
            "style": clean_text(r.get("style", "")),
            "division": clean_text(r.get("division", "")),
            "age_range": clean_text(r.get("age_range", "")),
            "level": clean_text(r.get("level", "")) or "All Levels",
            "is_audition_phrase": bool(r.get("is_audition_phrase", False)),
            "raw_text": clean_text(r.get("raw_text", "")),
        }

        key = (
            row["day"],
            row["start_time"],
            row["class_name"].lower(),
            row["division"].lower(),
            row["room"].lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        normalized.append(row)

    return normalized


def parse_wcde_convention(pdf_path: str) -> pd.DataFrame:
    grid_records = parse_grid_tables(pdf_path)
    breakout_records = parse_breakout_description_tables(pdf_path)

    records = add_duration_and_dedupe(grid_records + breakout_records)
    if not records:
        raise ValueError("No convention class rows found in PDF tables.")

    df = pd.DataFrame(records)

    desired_columns = [
        "class_name",
        "instructor",
        "room",
        "day",
        "start_time",
        "end_time",
        "duration",
        "style",
        "division",
        "age_range",
        "level",
        "is_audition_phrase",
        "raw_text",
    ]

    for col in desired_columns:
        if col not in df.columns:
            df[col] = ""

    return df[desired_columns]


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_wcde_convention.py \"WCDE - Biloxi_Class SCHED.pdf\"")
        sys.exit(1)

    pdf_path = sys.argv[1]
    try:
        df = parse_wcde_convention(pdf_path)
    except Exception as exc:
        print(f"Error while parsing WCDE convention schedule: {exc}")
        sys.exit(1)

    out_path = "wcde_convention_parsed.csv"
    df.to_csv(out_path, index=False)
    print(f"Parsed {len(df)} rows. Saved CSV to: {out_path}")


if __name__ == "__main__":
    main()