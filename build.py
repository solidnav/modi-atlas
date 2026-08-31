#!/usr/bin/env python3
"""Assemble the self-contained pages for The Modi Atlas.

Inlines the CSS, JS, vendor libraries (D3 + topojson-client) and the data
(visits + world TopoJSON) into a single static HTML with no external
JavaScript, so it runs anywhere.

Outputs:
  index.html        - a complete standalone document (doctype, viewport meta,
                      head/body) for GitHub Pages / opening directly.
  dist/embed.html   - the same content as body-only markup, for publishing as a
                      Claude Artifact (whose host supplies its own <head>).
"""
import pathlib

ROOT = pathlib.Path(__file__).parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")

# body-only assembled content (title, font link, style, markup, inlined scripts)
inner = (read("src/template.html")
         .replace("__STYLE__", read("src/styles.css"))
         .replace("__D3__", read("vendor/d3.min.js"))
         .replace("__TOPOJSON__", read("vendor/topojson-client.min.js"))
         .replace("__TOPO__", read("data/countries-110m.json").strip())
         .replace("__VISITS__", read("data/visits.json").strip())
         .replace("__APP__", read("src/app.js")))

standalone = (
    '<!doctype html>\n<html lang="en">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<meta name="description" content="An interactive world map of PM Narendra Modi\'s foreign visits, 2014-2026.">\n'
    '</head>\n<body>\n' + inner + '\n</body>\n</html>\n'
)

(ROOT / "index.html").write_text(standalone, encoding="utf-8")
(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist" / "embed.html").write_text(inner, encoding="utf-8")

print(f"Wrote index.html      ({len(standalone.encode())/1024:.1f} KB)")
print(f"Wrote dist/embed.html ({len(inner.encode())/1024:.1f} KB)")
