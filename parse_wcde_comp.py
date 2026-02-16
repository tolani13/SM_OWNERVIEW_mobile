import os
import re
import sys

import pandas as pd
import pdfplumber


def clean_cell(value):
    """
    Normalize a cell value:
    - convert None to empty string
    - replace newlines with spaces
    - collapse repeated whitespace
    - strip leading/trailing spaces
    """
    if value is None:
        return ""
    text = str(value)
    text = text.replace("\n", " ")
    text = " ".join(text.split())
    return text.strip()


DIVISION_TOKENS = [
    "PreTeen",
    "Intermediate",
    "Mini",
    "Junior",
    "Teen",
    "Senior",
    "Spark",
]

STYLE_TOKENS = [
    "Musical Theatre",
    "Musical Theater",
    "Hip Hop",
    "Hip-Hop",
    "Contemporary",
    "Lyrical",
    "Jazz",
    "Tap",
    "Open",
    "Ballet",
    "Acro",
]

GROUP_SIZE_TOKENS = [
    "Duo/Trio",
    "Small Group",
    "Large Group",
    "Production",
    "Line",
    "Solo",
    "Duet",
    "Trio",
]

DAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


def extract_day_label(text: str):
    normalized = clean_cell(text)
    if not normalized:
        return ""

    # Treat as a day header only when the row *starts* with a day label.
    # This avoids false positives like routine names containing "Friday".
    match = re.match(
        r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b",
        normalized,
        flags=re.IGNORECASE,
    )
    if not match:
        return ""

    token = match.group(1).lower()
    day_map = {
        "mon": "Monday",
        "monday": "Monday",
        "tue": "Tuesday",
        "tuesday": "Tuesday",
        "wed": "Wednesday",
        "wednesday": "Wednesday",
        "thu": "Thursday",
        "thursday": "Thursday",
        "fri": "Friday",
        "friday": "Friday",
        "sat": "Saturday",
        "saturday": "Saturday",
        "sun": "Sunday",
        "sunday": "Sunday",
    }
    return day_map.get(token, "")


def normalize_header_row(row):
    cleaned = [clean_cell(v) for v in row]

    # Some WCDE PDFs collapse the visible table header into one text cell.
    # We normalize it back to logical columns so detection still works.
    if len(cleaned) == 1:
        one = cleaned[0]
        if one.startswith("#") and "Name" in one and "Division" in one and "Style" in one and "Time" in one:
            return ["#", "Name", "Studio Icon", "Division", "Style", "Group Size", "Studio", "Time"]

    return cleaned


def is_matching_header(normalized_header):
    return len(normalized_header) >= 2 and normalized_header[0] == "#" and "Name" in normalized_header[1]


def find_first_token(text, tokens):
    """Return earliest token match in text as (start, end, token), else None."""
    best = None
    for token in sorted(tokens, key=len, reverse=True):
        pattern = r"\b" + re.escape(token).replace(r"\ ", r"\s+") + r"\b"
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if not match:
            continue

        candidate = (match.start(), match.end(), match.group(0))
        if best is None or candidate[0] < best[0]:
            best = candidate

    return best


def normalize_style(style_text):
    s = style_text.strip().lower().replace("-", " ")
    if s == "musical theatre" or s == "musical theater":
        return "Musical Theatre"
    if s == "hip hop":
        return "Hip Hop"
    return " ".join(word.capitalize() for word in s.split())


def normalize_group_size(size_text):
    s = size_text.strip().lower()
    if "duo" in s or "trio" in s or "duet" in s:
        return "Duo/Trio"
    if "small" in s:
        return "Small Group"
    if "large" in s:
        return "Large Group"
    if "production" in s:
        return "Production"
    if "line" in s:
        return "Line"
    return "Solo" if "solo" in s else size_text.strip()


def parse_single_cell_entry_line(line_text):
    """
    Parse one-cell extracted WCDE row text into normalized output columns.

    Expected rough shape:
      <entry_num> <dance_name> <division> <style> <group_size> <studio> <time>
    """
    line = clean_cell(line_text)
    if not line:
        return None

    start_match = re.match(r"^(\d+)\s+(.*)$", line)
    if not start_match:
        return None

    entry_num = start_match.group(1)
    rest = start_match.group(2).strip()

    division_match = find_first_token(rest, DIVISION_TOKENS)
    if not division_match:
        return {
            "entry_num": entry_num,
            "dance_name": rest,
            "division": "",
            "style": "",
            "group_size": "",
            "studio": "",
            "time": "",
        }

    div_start, div_end, div_token = division_match
    dance_name = clean_cell(rest[:div_start])
    after_division = rest[div_end:].strip()

    style_match = find_first_token(after_division, STYLE_TOKENS)
    if style_match:
        style_start, style_end, style_token = style_match
        style = normalize_style(style_token)
        after_style = after_division[style_end:].strip()
    else:
        style = ""
        after_style = after_division

    size_match = find_first_token(after_style, GROUP_SIZE_TOKENS)
    if size_match:
        size_start, size_end, size_token = size_match
        group_size = normalize_group_size(size_token)
        tail = after_style[size_end:].strip()
    else:
        group_size = ""
        tail = after_style

    # Remove competition-break/awards appendages if they were merged into a row
    tail = re.split(
        r"\b(?:COMPETITION\s+BREAK|COMPETITION\s+AWARDS?|SOLOBLAST\s*&\s*DUO/TRIO\s*COMPETITION|GROUP\s+COMPETITION)\b",
        tail,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip()

    time_match = re.search(r"\b\d{1,2}:\d{2}\b", tail)
    time = time_match.group(0) if time_match else ""
    if time_match:
        studio = (tail[: time_match.start()] + " " + tail[time_match.end() :]).strip()
    else:
        studio = tail

    return {
        "entry_num": entry_num,
        "dance_name": dance_name,
        "day": "",
        "division": clean_cell(div_token),
        "style": clean_cell(style),
        "group_size": clean_cell(group_size),
        "studio": clean_cell(studio),
        "time": clean_cell(time),
    }


def parse_wcde_comp(pdf_path: str) -> pd.DataFrame:
    """
    Parse a WCDE competition schedule PDF into a DataFrame.

    The parser scans tables from all pages, detects the competition table using a
    header where first column is '#' and second column contains 'Name', then
    stacks rows into one DataFrame.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    all_rows = []
    active_header = None
    current_day = ""
    found_tables = False
    found_matching_header = False

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables:
                continue

            found_tables = True

            for table in tables:
                if not table:
                    continue

                for row in table:
                    if not row:
                        continue

                    normalized_row = [clean_cell(v) for v in row]
                    if not any(normalized_row):
                        continue

                    normalized_header = normalize_header_row(normalized_row)
                    if is_matching_header(normalized_header):
                        active_header = normalized_header
                        found_matching_header = True
                        continue

                    row_text = " ".join(normalized_row)
                    detected_day = extract_day_label(row_text)
                    if detected_day:
                        current_day = detected_day
                        # Day heading row is context, not an entry row
                        continue

                    if active_header is None:
                        continue

                    # WCDE Biloxi extraction often returns each row as one cell.
                    if len(normalized_row) == 1:
                        parsed = parse_single_cell_entry_line(normalized_row[0])
                        if parsed is not None:
                            parsed["day"] = current_day
                            all_rows.append(parsed)
                        continue

                    # Keep support for true multi-column extraction if available.
                    length = min(len(active_header), len(normalized_row))
                    if length <= 0:
                        continue
                    record = {active_header[i]: normalized_row[i] for i in range(length)}
                    if current_day and "day" not in record:
                        record["day"] = current_day
                    all_rows.append(record)

    if not found_tables:
        raise ValueError("No tables were found in the PDF via page.extract_tables().")

    if not found_matching_header:
        raise ValueError(
            "No matching header found. Expected a row where first column is '#' "
            "and second column contains 'Name'."
        )

    if not all_rows:
        raise ValueError("Matching header found, but no data rows were extracted.")

    df = pd.DataFrame(all_rows)

    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].apply(clean_cell)

    rename_map = {
        "#": "entry_num",
        "Name": "dance_name",
        "Division": "division",
        "Style": "style",
        "Group Size": "group_size",
        "Studio": "studio",
        "Time": "time",
    }
    df = df.rename(columns=rename_map)

    # Keep only entry-like rows when available
    if "entry_num" in df.columns:
        df["entry_num"] = df["entry_num"].apply(clean_cell)
        df = df[df["entry_num"].str.match(r"^\d+$", na=False)]

    desired_order = [
        "entry_num",
        "dance_name",
        "day",
        "division",
        "style",
        "group_size",
        "studio",
        "time",
    ]

    # Keep only normalized output columns, creating any missing ones as empty
    for col in desired_order:
        if col not in df.columns:
            df[col] = ""

    df = df[desired_order]
    return df


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_wcde_comp.py \"WCDE - Biloxi_COMP SCHED.pdf\"")
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        df = parse_wcde_comp(pdf_path)
    except Exception as exc:
        print(f"Error while parsing WCDE competition schedule: {exc}")
        sys.exit(1)

    out_dir = os.path.dirname(os.path.abspath(pdf_path))
    out_path = os.path.join(out_dir, "wcde_competition_parsed.csv")
    df.to_csv(out_path, index=False)
    print(f"Parsed {len(df)} rows. Saved CSV to: {out_path}")


if __name__ == "__main__":
    main()