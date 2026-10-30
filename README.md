# Daily Fuel Tracker

A lightweight, responsive nutrition dashboard for tracking daily calorie intake, protein, and meal history.

**Live Website:** https://defranzo.github.io/daily-fuel-tracker/

## Features

- Daily calorie tracking with a 1,800 kcal target
- Protein intake and remaining calorie calculations
- Interactive daily summary and 7-day trends
- Detailed meal breakdowns
- Responsive design for desktop and mobile
- Automatic data refresh every 60 seconds

## Tech Stack

HTML · CSS · JavaScript · JSON · GitHub Pages

## Project Structure

```text
daily-fuel-tracker/
├── index.html     # Website structure
├── styles.css     # Styling and responsive layout
├── app.js         # Dashboard logic and charts
├── meals.json     # Nutrition records
└── README.md
```

## Getting Started

Clone the repository and open it in VS Code:

```bash
git clone https://github.com/DeFranzo/daily-fuel-tracker.git
cd daily-fuel-tracker
code .
```

Run `index.html` using the **Live Server** extension.

## Updating Data

Edit `meals.json` to add or update meals. Daily totals and charts are calculated automatically.

Push changes to `main` to deploy through GitHub Pages.

---

Built for simple, consistent nutrition tracking.
