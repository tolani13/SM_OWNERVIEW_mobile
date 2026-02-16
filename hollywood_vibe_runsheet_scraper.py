"""
Hollywood Vibe Run Sheet Scraper (standalone)

Requirements:
  pip install playwright
  playwright install

Usage:
  python hollywood_vibe_runsheet_scraper.py

Notes:
- This launches a visible browser so you can log in manually.
- After you navigate to the correct event/run sheet, return to terminal and press Enter.
- Output CSV is written to hollywood_vibe_runsheet.csv in the current folder.
"""

from playwright.sync_api import sync_playwright
import csv
import re


EVENT_URL = "https://hollywoodvibe.tourproapps.com/"  # or a specific event link


def parse_card_text(raw: str):
    """
    Parse one routine card's text into structured fields.
    Expected pattern (lines):
      0: "344 - Rich Girls"
      1: "10:11 PM"
      2: "Senior Large Group Open/Acro"
      3: "Verve Dance Company (R)"
      4+: "Performers: name1, name2, ..."
    """
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    if not lines:
        return {}

    m = re.match(r"^(\d+)\s*-\s*(.+)$", lines[0])
    if m:
        entry_num = m.group(1)
        routine_name = m.group(2)
    else:
        entry_num = ""
        routine_name = lines[0]

    time = lines[1] if len(lines) > 1 else ""
    category = lines[2] if len(lines) > 2 else ""
    studio = lines[3] if len(lines) > 3 else ""

    performers = ""
    # Look for "Performers:" (may be on its own line or at start of a line)
    for i, ln in enumerate(lines[4:], start=4):
        if ln.lower().startswith("performers"):
            performers = " ".join(lines[i:])  # keep full text
            break

    return {
        "entry_num": entry_num,
        "routine_name": routine_name,
        "time": time,
        "category": category,
        "studio": studio,
        "performers": performers,
    }


def scrape_hv_runsheet(event_url: str, out_csv: str):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        # 1) Open HV app, let you log in and navigate manually.
        page.goto(event_url)
        input(
            "In the opened browser window, log in and navigate to the run sheet.\n"
            "Once you see the routine list (e.g., '344 - Rich Girls'), press Enter here..."
        )

        # 2) Find iframe that contains the schedule section URL.
        schedule_frame = None
        for frame in page.frames:
            if "apiv3/release/iphone/10/section/" in (frame.url or ""):
                schedule_frame = frame
                break

        if schedule_frame is None:
            browser.close()
            raise RuntimeError(
                "Could not find schedule iframe. Make sure the run sheet is visible."
            )

        # 3) Inside iframe, select all routine blocks under #RoutinesList
        entries = []
        blocks = schedule_frame.locator("#RoutinesList div.list-group-item-text")

        for b_index in range(blocks.count()):
            block = blocks.nth(b_index)

            # Date header like "02/13/2026"
            try:
                date_text = block.locator("h4").inner_text().strip()
            except Exception:
                date_text = ""

            # Each <li> inside list should be one routine card
            cards = block.locator("ul.list-info li")
            for c_index in range(cards.count()):
                card = cards.nth(c_index)
                raw_text = card.inner_text().strip()
                parsed = parse_card_text(raw_text)
                if parsed:
                    parsed["block_date"] = date_text
                    entries.append(parsed)

        browser.close()

    if not entries:
        print(
            "No entries found - check selectors "
            "(#RoutinesList, div.list-group-item-text, ul.list-info li)."
        )
        return

    fieldnames = [
        "block_date",
        "entry_num",
        "routine_name",
        "time",
        "category",
        "studio",
        "performers",
    ]
    with open(out_csv, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(entries)

    print(f"Wrote {len(entries)} rows to {out_csv}")


if __name__ == "__main__":
    scrape_hv_runsheet(EVENT_URL, "hollywood_vibe_runsheet.csv")
