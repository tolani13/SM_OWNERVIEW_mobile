import pdfplumber
import pandas as pd
import re


def extract_schedule(pdf_path):
    entries = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # Extract text while preserving layout
            text = page.extract_text(layout=True) or ""
            lines = text.split("\n")

            for line in lines:
                # Pattern: Entry #, Name, Division, Group Size, Style, Time, Studio
                # Matches lines like: "24 My Kind Of Guy Junior Solo Jazz 9:10 Conservatory Of Dance Arts"
                pattern = r"(\d+)\s+([A-Za-z\s\']+)\s+(Mini|Junior|Teen|Senior)\s+(Solo|Duo/Trio|Small Group|Large Group|Line|Production)\s+(Jazz|Contemporary|Lyrical|Tap|Hip Hop|Musical Theatre|Open|Ballet|Fusion)\s+(\d{1,2}:\d{2})?\s+([A-Za-z\s,]+)"

                match = re.match(pattern, line.strip())
                if match:
                    entry_num, name, division, group_size, style, time, studio = match.groups()
                    entries.append(
                        {
                            "entry_num": entry_num.strip(),
                            "dance_name": name.strip(),
                            "division": division,
                            "group_size": group_size,
                            "style": style,
                            "time": time or "",
                            "studio": studio.strip(),
                        }
                    )

    return pd.DataFrame(entries)


if __name__ == "__main__":
    pdf_path = "attached_assets/S.30_Biloxi_Competition_Schedule_1767116592640.pdf"
    df = extract_schedule(pdf_path)
    df.to_csv("biloxi_clean.csv", index=False)
    print(f"Extracted rows: {len(df)}")
    if len(df) > 0:
        print(df.head(10).to_string(index=False))
    print("Wrote biloxi_clean.csv")