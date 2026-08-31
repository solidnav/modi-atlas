#!/usr/bin/env python3
"""One-off data correction for mislabelled stops in data/visits.json.

Wikipedia lists Modi's UN-climate-summit trips (COP21 Paris, COP26 Glasgow,
COP28 Dubai) under a "United Nations" grouping, so the scraper tagged them as
"United States (UN, New York)" and pinned them to New York. They are really
France, the United Kingdom and the United Arab Emirates. This also trims the
verbose "(UN, New York)"/"(Brussels)" tails on the genuine US and EU stops, so
the boarding pass shows a clean, complete country name.
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
p = ROOT / "data" / "visits.json"
data = json.loads(p.read_text(encoding="utf-8"))

# seq -> corrected (country, rawCountry, lon, lat, city)  [city None = keep]
REASSIGN = {
    33:  ("France",               "France",               2.3522, 48.8566, "Paris"),
    112: ("United Kingdom",       "United Kingdom",      -4.2518, 55.8642, "Glasgow"),
    133: ("United Arab Emirates", "United Arab Emirates", 55.2708, 25.2048, "Dubai"),
}

changed = 0
for v in data:
    s = v.get("seq")
    if s in REASSIGN:
        c, raw, lon, lat, city = REASSIGN[s]
        v["country"], v["rawCountry"] = c, raw
        v["lon"], v["lat"] = lon, lat
        if city:
            v["city"] = city
        changed += 1
    elif v.get("country") == "United States (UN, New York)":
        v["country"] = "United States"           # keep rawCountry "United Nations"
        changed += 1
    elif v.get("country") == "European Union (Brussels)":
        v["country"] = "European Union"           # keep rawCountry "European Union"
        changed += 1

# preserve the existing one-key-per-line, zero-indent, ASCII style
p.write_text(json.dumps(data, indent=0, ensure_ascii=True) + "\n", encoding="utf-8")
print(f"Patched {changed} entries -> {p}")
