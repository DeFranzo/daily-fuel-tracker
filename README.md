# Daily Fuel Tracker

Static GitHub Pages website. Contains nutrition logs in meals.json (public if the repository is public).

Setup: upload index.html and meals.json to the ROOT of the main branch.
Then GitHub -> Settings -> Pages -> Build and deployment -> Deploy from a branch -> main -> /(root) -> Save.
Expected website URL: https://defranzo.github.io/daily-fuel-tracker/ (available only after GitHub Pages is enabled and deployed).

To update a meal later, replace meals.json in the repository with the updated JSON data.
The live website refreshes data periodically, and a reload also fetches fresh data.
