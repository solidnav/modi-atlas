# The Modi Atlas

An interactive world map that animates Prime Minister Narendra Modi's foreign
visits from his first trip in June 2014 to the present. Press play and watch him
hop country to country; scrub the timeline back and forth; hover or tap any stop
for its dates, duration, purpose and any state honour received.

**Live:** https://solidnav.github.io/modi-atlas/

## Features

- **Accurate world map** (Natural Earth projection, real country borders) in a
  bright light theme.
- **Draggable timeline** from 2014 to now, with a tick per trip and gold ticks
  where a foreign honour was received.
- **Animated journey** — each hop draws a great-circle arc, and the whole travel
  path builds into a flight-web as the trip advances.
- **Boarding-pass panel** with the route, city, dates, duration, purpose, cost
  and medal for the active stop.
- **Gold-medal markers** on every visit where Modi received a foreign state
  honour, with a celebratory burst when one is earned.
- **Estimated-cost counter** — a per-trip and cumulative taxpayer-cost estimate
  (see the honesty note below).
- **Mobile friendly** and keyboard accessible; respects reduced-motion.

## Data & honesty notes

- **Trips and honours** are compiled from Wikipedia,
  *List of international prime ministerial trips made by Narendra Modi*.
- **Cost is an estimate, not an official figure.** India's government discloses
  only year-wise totals of PM foreign-travel spending in Parliament, never a
  per-trip figure. The number shown here is a transparent guesstimate: round-trip
  flying hours from Delhi × an assumed hourly VVIP-aircraft cost, plus a per-day
  cost for the delegation, plus a fixed overhead. It is illustrative only. The
  model lives in [`src/app.js`](src/app.js) (search for `estCr`) — adjust the
  constants there if you have better figures.

## Run locally

No build tooling or dependencies to install — everything is inlined.

```bash
python3 build.py          # assembles index.html (and dist/embed.html)
python3 -m http.server    # then open http://localhost:8000/
```

## Project layout

```
src/          template.html, styles.css, app.js  (edit these)
data/         visits.json, countries-110m.json    (the data)
vendor/       d3.min.js, topojson-client.min.js   (inlined at build)
scripts/      the Wikipedia parsing pipeline
build.py      inlines everything into index.html
index.html    the built, self-contained page (committed)
```

Edit anything under `src/`, `data/` or `vendor/`, then re-run `python3 build.py`.

## Tech

Vanilla JS + [D3](https://d3js.org) (geo, zoom, transitions) and
[topojson-client](https://github.com/topojson/topojson-client). No framework,
no external requests at runtime — the page is a single self-contained file.
