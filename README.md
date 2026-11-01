# Daily Fuel

A lightweight, responsive calorie and protein tracker with private, account-based nutrition tracking.

**[Live Website](https://defranzo.github.io/daily-fuel-tracker/)**

## Features

- Track daily calories, protein, and remaining calorie allowance.
- Log, edit, and delete meals.
- View daily summaries and weekly nutrition trends.
- Set a personalized daily calorie target.
- Access your private meal history across devices.
- Responsive interface for desktop and mobile.

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Supabase (Auth + PostgreSQL)
- **Hosting:** GitHub Pages
- **Access Control:** PostgreSQL Row Level Security (RLS)

## Getting Started

1. Clone the repository and open it in VS Code.
2. Create a Supabase project and configure Authentication.
3. Create the required database tables (`meals` and `profiles`) with user-specific RLS policies.
4. Add your Supabase Project URL and publishable key to `supabase-config.js`.
5. Launch locally using Live Server or deploy through GitHub Pages.

> Never include Supabase secret keys or `service_role` credentials in frontend code.

## Security

Daily Fuel uses Supabase Authentication and PostgreSQL Row Level Security to restrict access to each user's data.

- Meal records and calorie targets are isolated by account.
- Database operations require authentication and enforce ownership policies.
- The frontend is publicly hosted, but private nutrition data requires authorized access.
- Only the Supabase publishable key is exposed to the browser.

## Deployment

Push changes to the `main` branch to trigger the GitHub Actions deployment workflow.

The website is hosted at:

https://defranzo.github.io/daily-fuel-tracker/

---

Built for simple, consistent nutrition tracking.
