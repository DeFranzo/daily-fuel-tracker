# Daily Fuel Tracker

Static GitHub Pages website, with a separate `meals.json` data file.

## Local development

Open this folder in VS Code and run **Live Server** on `index.html`, or use `python -m http.server 5500` and open http://localhost:5500.

Do not open `index.html` directly with `file://`; fetching `meals.json` may be blocked by the browser.

## Updating records

Add or edit records in `meals.json` using these fields: `date` (YYYY-MM-DD), `meal`, `food`, `breakdown`, `calories`, `protein`. Use numeric calories/protein and escape newlines as `\n` within JSON strings.

The website recalculates daily totals automatically and checks for updated meals.json every 60 seconds. If a selected date is not the newest, it remains selected during refresh.

## Deploy

Commit the files to the root of the `main` branch of `DeFranzo/daily-fuel-tracker`. GitHub Pages is already configured to publish that branch.

Note: GitHub Pages and the repository are public; nutrition records will be visible to others.
