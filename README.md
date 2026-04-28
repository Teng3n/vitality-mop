# vitality-mop

A static-first Astro + TypeScript MVP for Vitality, a World of Warcraft Mists of Pandaria Classic guild website. The site uses local sample JSON in `src/data` so public roster, loot, and bench data can be replaced later without adding secrets or private officer notes.

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

Optional local data sync:

```bash
cp .env.example .env.local
# Fill in GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON, and sheet ranges if needed.
npm run sync:data
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

Current public site data lives in:

- `src/data/roster.json`
- `src/data/calendar.json`
- `src/data/lootSummary.json`
- `src/data/lootHistory.json`
- `src/data/bench.json`

## Automated data sync

The site is still static. Runtime visitors never fetch Google Sheets directly, and the Google Sheet does not need to be public. Instead, GitHub Actions authenticates to the private sheet with a Google service account, regenerates the JSON files in `src/data`, commits only real JSON changes, and Cloudflare Pages redeploys from that GitHub commit.

Pipeline:

```text
Private Google Sheet -> Google Sheets API -> scripts/sync-google-sheets.ts -> src/data/*.json -> GitHub commit -> Cloudflare Pages deploy
```

Required GitHub Actions secrets:

- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

The service account JSON must stay in GitHub Secrets or a private local `.env.local` file. Do not commit the service account file or paste it into frontend code. Share the Google Sheet directly with the service account email as Viewer.

Optional GitHub Actions variables for non-sensitive sheet ranges:

- `ROSTER_RANGE`, default `Roster!A:Z`
- `CALENDAR_RANGE`, default `Calendar!A:ZZ`
- `LOOT_RANGE`, default `History!A:Z`

Optional local-only variable:

- `CALENDAR_START_YEAR` is only needed for a first sync when calendar headers do not include years and there is no existing `src/data/calendar.json` to preserve year mappings.

Example `.env.local` shape:

```bash
GOOGLE_SHEET_ID=your-private-sheet-id
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"..."}
ROSTER_RANGE=Roster!A:Z
CALENDAR_RANGE=Calendar!A:ZZ
LOOT_RANGE=History!A:Z
```

Run locally:

```bash
npm run sync:data
```

Build after syncing:

```bash
npm run build:with-data
```

The workflow lives at `.github/workflows/sync-data.yml`. It runs every 6 hours via UTC cron and can also be triggered manually from GitHub:

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Sync guild data**.
4. Click **Run workflow**.

The workflow intentionally avoids unnecessary Cloudflare builds:

- It runs `npm run sync:data`.
- It checks `git diff --quiet -- src/data/*.json`.
- If there are no generated JSON changes, it prints `No data changes detected.` and exits successfully.
- If there are changes, it stages and commits only `src/data/*.json`.
- It never writes generated timestamps such as `lastSyncedAt`, `generatedAt`, or `updatedAt` into committed JSON.

Generated files:

- `src/data/roster.json`
- `src/data/calendar.json`
- `src/data/lootHistory.json`
- `src/data/lootSummary.json`
- `src/data/bench.json`

Troubleshooting:

- Missing `GOOGLE_SHEET_ID` or `GOOGLE_SERVICE_ACCOUNT_JSON`: add the required repository secret in GitHub.
- Inaccessible sheet: confirm the sheet is shared with the service account email as Viewer.
- Wrong range: set `ROSTER_RANGE`, `CALENDAR_RANGE`, or `LOOT_RANGE` to the correct tab and columns.
- Invalid service account JSON: store the full JSON as one GitHub secret; escaped private-key newlines are supported.
- Missing sheet columns: check the Action logs for the required column names reported by the sync script.
- No changes detected: this is expected when the sheet data has not changed.

Manual fallback path:

1. Export Google Sheet tabs to CSV or XLSX.
2. Convert the public fields to JSON.
3. Replace the matching files in `src/data`.
4. Commit the JSON updates to GitHub.
5. Cloudflare Pages redeploys automatically from the connected branch.

Keep raw form responses, private comments, attendance explanations, credentials, and officer-only notes out of the repository.

For the current workbook format, run:

```bash
python scripts/backfill_from_workbook.py "C:/path/to/Copy of Inept - MoP.xlsx"
```

The converter requires Python with `openpyxl`. It reads the reduced public workbook tabs (`Calendar`, `History`, and `Bench`) and writes `roster.json`, `lootSummary.json`, `lootHistory.json`, and `bench.json`.

For a loot-only History TSV export, run:

```bash
node scripts/backfill_loot_from_tsv.mjs "C:/path/to/Inept - MoP - History.tsv"
```

The TSV converter writes only `lootHistory.json` and `lootSummary.json`. It keeps the public award fields and ignores raw item strings, votes, gear comparisons, notes, owners, and IDs.

For a Calendar CSV export, run:

```bash
node scripts/backfill_calendar_from_csv.mjs "C:/path/to/Copy of Inept - MoP - Calendar.csv"
```

The Calendar converter writes `calendar.json` with public schedule statuses and summary counts only.

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
