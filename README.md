# vitality-mop

A static-first Astro + TypeScript MVP for Vitality, a World of Warcraft Mists of Pandaria Classic guild website. The site uses local sample JSON in `src/data` so public roster, loot, bench, and legendary-progress data can be replaced later without adding secrets or private officer notes.

## Local Setup

```bash
npm install
npm run dev
npm run build
```

Optional checks:

```bash
npm run check
```

## GitHub Workflow

```bash
git checkout -b feature/guild-site-mvp
git add .
git commit -m "Build static Astro guild site MVP"
git push --set-upstream origin feature/guild-site-mvp
```

Open a pull request from `feature/guild-site-mvp` into the default branch.

## Cloudflare Pages Deployment

Connect Cloudflare Pages to the GitHub repository and use these build settings:

- Framework preset: Astro
- Build command: `npm run build`
- Output directory: `dist`
- Node version: current LTS
- Environment variables: none required for MVP

This MVP uses Astro static output and does not require Cloudflare Workers, Pages Functions, D1, KV, R2, auth, secrets, or live Google Sheets access.

## Data Updates

Current data is sample-only and lives in:

- `src/data/roster.json`
- `src/data/lootSummary.json`
- `src/data/lootHistory.json`
- `src/data/bench.json`
- `src/data/legendaryProgress.json`

Future update path:

1. Export Google Sheet tabs to CSV or XLSX.
2. Convert the public fields to JSON.
3. Replace the matching files in `src/data`.
4. Commit the JSON updates to GitHub.
5. Cloudflare Pages redeploys automatically from the connected branch.

Keep raw form responses, private comments, attendance explanations, credentials, and officer-only notes out of the repository.

## Project Structure

```text
src/
  components/       Shared Astro components
  data/             Sample static JSON data
  layouts/          Site layout and navigation
  pages/            Static route pages
  styles/           Global CSS
public/             Static assets and Cloudflare Pages headers
```

Pages Functions can be added later with a top-level `functions/` directory if the site needs dynamic behavior.
