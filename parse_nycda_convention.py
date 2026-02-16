import os
import re
import sys
from typing import Dict, List, Optional, Tuple

import pandas as pd
import pdfplumber


HEADER_LABELS = ["SENIORS", "TEENS", "JUNIORS", "MINIS", "RSD"]

TIME_PATTERN = re.compile(
    r"^\d{1,2}:\d{2}(?:\s*(?:am|pm))?(?:\s*-\s*\d{1,2}:\d{2}(?:\s*(?:am|pm))?)?$",
    re.IGNORECASE,
)

LEVEL_MAP = {
    "SENIORS": "Senior",
    "TEENS": "Teen",
    "JUNIORS": "Junior",
    "MINIS": "Mini",
    "RSD": "RSD",
}


def clean_text(value) -> str:
    if value is None:
        return ""
    text = str(value).replace("\r", " ").replace("\n", " ")
    return " ".join(text.split()).strip()


def normalize_level(raw_level: str) -> str:
    key = clean_text(raw_level).upper()
    return LEVEL_MAP.get(key, clean_text(raw_level))


def _clock_to_minutes(clock: str, meridiem: Optional[str]) -> Optional[int]:
    match = re.match(r"^(\d{1,2}):(\d{2})$", clean_text(clock))
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2))
    if minute < 0 or minute > 59:
        return None

    if meridiem:
        mer = meridiem.lower()
        if hour < 1 or hour > 12:
            return None
        if hour == 12:
            hour = 0
        if mer == "pm":
            hour += 12
    else:
        if hour < 0 or hour > 23:
            return None

    return hour * 60 + minute


def _minutes_to_hhmm(total_minutes: int) -> str:
    normalized = total_minutes % (24 * 60)
    hour = normalized // 60
    minute = normalized % 60
    return f"{hour:02d}:{minute:02d}"


def parse_time_range(value: str) -> Tuple[Optional[str], Optional[str], Optional[int]]:
    """
    Converts NYCDA time cell values into start/end/duration.

    Handles examples like:
      - 7:30-8:15am
      - 7:30am-8:15am
      - 13:00-14:00
      - 7:30am
    """
    text = clean_text(value).lower().replace(" ", "")
    if not text:
        return None, None, None

    range_match = re.match(
        r"^(\d{1,2}:\d{2})(am|pm)?-(\d{1,2}:\d{2})(am|pm)?$",
        text,
    )
    if range_match:
        start_clock, start_mer, end_clock, end_mer = range_match.groups()

        # If one side has meridiem and the other doesn't, infer missing side.
        if not start_mer and end_mer:
            start_mer = end_mer
        if start_mer and not end_mer:
            end_mer = start_mer

        start_minutes = _clock_to_minutes(start_clock, start_mer)
        end_minutes = _clock_to_minutes(end_clock, end_mer)
        if start_minutes is None or end_minutes is None:
            return None, None, None

        duration = end_minutes - start_minutes
        if duration <= 0:
            duration += 12 * 60

        return (
            _minutes_to_hhmm(start_minutes),
            _minutes_to_hhmm(start_minutes + duration),
            duration,
        )

    single_match = re.match(r"^(\d{1,2}:\d{2})(am|pm)?$", text)
    if single_match:
        start_clock, start_mer = single_match.groups()
        start_minutes = _clock_to_minutes(start_clock, start_mer)
        if start_minutes is None:
            return None, None, None
        fallback_duration = 60
        return (
            _minutes_to_hhmm(start_minutes),
            _minutes_to_hhmm(start_minutes + fallback_duration),
            fallback_duration,
        )

    return None, None, None


def parse_nycda_convention(pdf_path: str) -> pd.DataFrame:
    """
    Parse an NYCDA convention schedule PDF into a flat table.

    Returns normalized columns expected by server/pdf-parser-routes.ts.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    all_events: List[Dict[str, object]] = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            raw_text = page.extract_text() or ""

            day_match = re.search(
                r"(Thursday|Friday|Saturday|Sunday)(?:,\s+[A-Za-z]+\s+\d{1,2})?",
                raw_text,
                re.IGNORECASE,
            )
            day_label = day_match.group(1).title() if day_match else ""

            page_events = _extract_convention_page(page, day_label)
            all_events.extend(page_events)

    if not all_events:
        raise ValueError(
            "No NYCDA convention rows detected. "
            "Check that the PDF uses SENIORS/TEENS/JUNIORS/MINIS/RSD schedule columns."
        )

    df = pd.DataFrame(all_events)
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
        # keep extras for debugging/compatibility
        "time",
        "teacher",
    ]

    for column in desired_columns:
        if column not in df.columns:
            df[column] = ""

    return df[desired_columns]


def _extract_convention_page(page, day_label: str) -> List[Dict[str, object]]:
    words = page.extract_words() or []

    # 1) Find header candidates for SENIORS / TEENS / JUNIORS / MINIS / RSD
    header_candidates = [
        w for w in words if clean_text(w.get("text", "")).upper() in HEADER_LABELS
    ]
    if len(header_candidates) < 3:
        return []

    # 2) Cluster header words by vertical position and pick row with most labels
    clusters: Dict[int, List[dict]] = {}
    for w in header_candidates:
        key = round(float(w["top"]) / 5) * 5
        clusters.setdefault(key, []).append(w)

    _, best_words = max(clusters.items(), key=lambda kv: len(kv[1]))
    headers = sorted(best_words, key=lambda w: float(w["x0"]))

    column_names = [clean_text(w["text"]).upper() for w in headers]
    centers = [(float(w["x0"]) + float(w["x1"])) / 2 for w in headers]

    def assign_col(x_center: float) -> str:
        diffs = [abs(x_center - c) for c in centers]
        idx = min(range(len(centers)), key=lambda i: diffs[i])
        return column_names[idx]

    # 3) Take words below the header row as schedule content
    header_bottom = max(float(w["bottom"]) for w in headers)
    schedule_words = [w for w in words if float(w["top"]) > header_bottom + 2]

    for w in schedule_words:
        w["ycenter"] = (float(w["top"]) + float(w["bottom"])) / 2

    schedule_words.sort(key=lambda w: float(w["ycenter"]))

    # 4) Group into horizontal rows by Y distance
    rows: List[List[dict]] = []
    current: List[dict] = []
    last_y: Optional[float] = None
    row_threshold = 4

    for w in schedule_words:
        y = float(w["ycenter"])
        if last_y is None or abs(y - last_y) <= row_threshold:
            current.append(w)
        else:
            rows.append(current)
            current = [w]
        last_y = y

    if current:
        rows.append(current)

    # 5) Build per-column cell text for each row
    def build_row_cells(row_words: List[dict]) -> Dict[str, str]:
        cells: Dict[str, List[str]] = {name: [] for name in column_names}
        for w in sorted(row_words, key=lambda item: float(item["x0"])):
            x_center = (float(w["x0"]) + float(w["x1"])) / 2
            col = assign_col(x_center)
            cells[col].append(clean_text(w["text"]))
        return {name: " ".join(tokens).strip() for name, tokens in cells.items()}

    cell_rows = [build_row_cells(r) for r in rows]
    if not cell_rows:
        return []

    # First row under headers is usually room labels
    room_row = cell_rows[0]

    def is_time_cell(text: str) -> bool:
        return bool(TIME_PATTERN.match(clean_text(text)))

    def is_time_row(cells: Dict[str, str]) -> bool:
        return sum(1 for v in cells.values() if v and is_time_cell(v)) >= 2

    events: List[Dict[str, object]] = []

    # 6) Time row pairs with style row (row-1) and teacher row (row-2)
    for idx, cells in enumerate(cell_rows):
        if not is_time_row(cells):
            continue

        style_row = (
            cell_rows[idx - 1]
            if idx - 1 >= 0
            else {name: "" for name in column_names}
        )
        teacher_row = (
            cell_rows[idx - 2]
            if idx - 2 >= 0
            else {name: "" for name in column_names}
        )

        for level_key in column_names:
            time_text = clean_text(cells.get(level_key, ""))
            if not time_text or not is_time_cell(time_text):
                continue

            style_text = clean_text(style_row.get(level_key, ""))
            teacher_text = clean_text(teacher_row.get(level_key, ""))
            room_text = clean_text(room_row.get(level_key, ""))
            division = normalize_level(level_key)

            start_time, end_time, duration = parse_time_range(time_text)
            if not start_time or not end_time:
                continue

            class_name = style_text or f"{division} Class"
            raw_text = " | ".join(
                [part for part in [style_text, teacher_text, time_text] if part]
            )

            events.append(
                {
                    "day": day_label,
                    "level": division,
                    "division": division,
                    "room": room_text,
                    "time": time_text,
                    "start_time": start_time,
                    "end_time": end_time,
                    "duration": duration,
                    "teacher": teacher_text,
                    "instructor": teacher_text,
                    "style": style_text,
                    "class_name": class_name,
                    "age_range": "",
                    "is_audition_phrase": "audition" in f"{class_name} {teacher_text}".lower(),
                    "raw_text": raw_text,
                }
            )

    return events


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_nycda_convention.py 'NYCDA Convention Schedule.pdf'")
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        df = parse_nycda_convention(pdf_path)
    except Exception as error:
        print(f"Error while parsing NYCDA convention schedule: {error}")
        sys.exit(1)

    out_dir = os.path.dirname(os.path.abspath(pdf_path))
    out_path = os.path.join(out_dir, "nycda_convention_parsed.csv")
    df.to_csv(out_path, index=False, encoding="utf-8-sig")

    print(f"Parsed {len(df)} rows. Saved CSV to: {out_path}")


if __name__ == "__main__":
    main()
