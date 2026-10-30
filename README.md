# Daily Fuel Tracker

Personal nutrition dashboard for daily calories, protein, and 7-day trends.

**Live:** https://defranzo.github.io/daily-fuel-tracker/

## Run locally

Open `index.html` using VS Code Live Server. Data is loaded from `meals.json`.

## Log meals from your phone

Use **Add a Meal** at the bottom of the website. Enter the date, meal, calories, protein, and paste the meal breakdown (first line = dish name). Tap **Send meal to tracker**, sign in to GitHub as **DeFranzo**, then select **Submit new issue**.

GitHub Actions verifies the issue author and adds the meal to `meals.json`, triggering the existing GitHub Pages deployment. Enable **Issues** and **Actions**. In **Settings → Pages**, change **Source** to **GitHub Actions** (one time); the workflow deploys after each accepted meal and each push to `main`.

The repo and its meal history are **public**. No images, password, or personal access token are stored on the website.
