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
# Fill in GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON, and CALENDAR_START_YEAR.
npm run sync:sheets

# Optional: fill in WCL_CLIENT_ID and WCL_CLIENT_SECRET to sync Warcraft Logs data.
npm run sync:wcl
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
- Environment variables: none required for the static pages. The optional Officer Sync buttons require the Cloudflare Pages Function variables documented below.

The public pages use Astro static output and do not require Cloudflare Workers, D1, KV, R2, auth, or live browser-side Google Sheets access. The manual officer sync trigger is implemented as a Cloudflare Pages Function so GitHub credentials stay server-side.

## Data Updates

Current public site data lives in:

- `src/data/roster.json`
- `src/data/calendar.json`
- `src/data/lootSummary.json`
- `src/data/lootHistory.json`
- `src/data/bench.json`
- `src/data/benchRules.json`
- `src/data/syncMeta.json`
- `src/data/wclReports.json`
- `src/data/wclBossAttendance.json`
- `src/data/wclBossAttendanceSummary.json`
- `src/data/wclGuildProgress.json`
- `src/data/wclProgressionSeed.json`
- `src/data/wclRankings.json`
- `src/data/wclSyncMeta.json`

## Automated data sync

The site is still static. Runtime visitors never fetch Google Sheets or Warcraft Logs directly, and the Google Sheet does not need to be public. Instead, GitHub Actions has separate server-side workflows for routine Google Sheet data and Warcraft Logs progression archive data. Each workflow regenerates the relevant JSON files in `src/data`, commits only real JSON changes, and Cloudflare Pages redeploys from that GitHub commit.

Pipeline:

```text
Private Google Sheet Calendar + History + Bench Rules tabs -> Google Sheets API -> scripts/sync-google-sheets.ts -> src/data/*.json -> GitHub commit -> Cloudflare Pages deploy
Warcraft Logs API v2 reports + fights -> scripts/sync-warcraft-logs.ts -> src/data/wcl*.json -> separate GitHub commit guard
```

Required GitHub Actions secrets:

- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

The service account JSON must stay in GitHub Secrets or a private local `.env.local` file. Do not commit the service account file or paste it into frontend code. Share the Google Sheet directly with the service account email as Viewer.

Optional GitHub Actions secrets for Warcraft Logs:

- `WCL_CLIENT_ID`
- `WCL_CLIENT_SECRET`

These are OAuth client credentials for Warcraft Logs API v2. Keep them in GitHub Secrets or a private local `.env.local` file. They are used only by sync scripts and are never exposed to frontend code. If either value is missing, the sync logs `Skipping Warcraft Logs sync: missing credentials.` and preserves any existing Warcraft Logs JSON.

Optional GitHub Actions variables for non-sensitive sheet ranges:

- `CALENDAR_RANGE`, default `Calendar!A:ZZ`
- `LOOT_RANGE`, default `History!A:Z`
- `BENCH_RULES_RANGE`, default `Bench Rules!A:I`
- `CALENDAR_START_YEAR`, default none in GitHub Actions. Set this when Calendar date headers omit years.

Optional GitHub Actions variables for Warcraft Logs:

- `WCL_GUILD_NAME`, default `Vitality`
- `WCL_SERVER_SLUG`, default `raden`
- `WCL_REGION`, default `US`
- `WCL_REPORT_LIMIT`, default `20`, maximum `100`
- `WCL_REPORT_PAGES`, default `25`, maximum `50`
- `WCL_GUILD_SOURCES_JSON`, optional JSON array for multi-guild WCL sources. Sources can include optional `guildId`. When set and valid, it replaces the single-source `WCL_GUILD_NAME`/`WCL_SERVER_SLUG`/`WCL_REGION` lookup. If it is missing or malformed, the sync uses the audited default archive mapping below unless explicit single-guild vars are configured.

Recommended `WCL_GUILD_SOURCES_JSON` from the Warcraft Logs guild history audit:

```json
[
  {
    "guildName": "Vitality",
    "serverSlug": "raden",
    "region": "US",
    "label": "Vitality - Raden",
    "expansions": ["mop"],
    "tiers": ["tier-14", "tier-15", "tier-16"]
  },
  {
    "guildId": 482914,
    "guildName": "Might",
    "serverSlug": "fairbanks",
    "region": "US",
    "label": "Might - Fairbanks",
    "expansions": ["classic", "tbc"],
    "tiers": ["classic-mc-ony", "classic-bwl", "classic-aq", "classic-naxx", "tbc-tier-4", "tbc-tier-5"]
  },
  {
    "guildId": 619658,
    "guildName": "Inept",
    "serverSlug": "grobbulus",
    "region": "US",
    "label": "Inept - Grobbulus",
    "expansions": ["tbc", "wrath"],
    "tiers": ["tbc-tier-5", "tbc-tier-6", "tbc-sunwell", "wrath-tier-7", "wrath-tier-8", "wrath-tier-9", "wrath-tier-10"]
  },
  {
    "guildId": 738773,
    "guildName": "Inept",
    "serverSlug": "benediction",
    "region": "US",
    "label": "Inept - Benediction",
    "expansions": ["cata"],
    "tiers": ["cata-tier-11", "cata-tier-12", "cata-tier-13"]
  }
]
```

Calendar is the roster source of truth. Anyone listed as a player row in the Calendar range is treated as active roster and is used to generate `src/data/roster.json`, `src/data/calendar.json`, and `src/data/bench.json`.

Expected Calendar columns:

- `#` is optional.
- `Name`, `Player`, or `Character` is required.
- `Class` is required.
- `Spec` or `Specialization` is required.
- `Role` is optional. If missing, role is derived from Class + Spec.
- `Realm` or `Server` is optional. Use it for characters off the guild realm, for example `Lei Shen`; player profiles prefer this roster realm when building direct Warcraft Logs links.
- Raid date columns come after the roster columns, usually with `CALENDAR_RANGE=Calendar!A:ZZ`.
- Date headers can be `May 03`, `May 04`, `Jun 01`, `2026-05-03`, or `May 03, 2026`.
- If date headers do not include years and no existing calendar JSON can preserve the year mapping, set `CALENDAR_START_YEAR`, for example `2026`.
- Raid date cells may be blank or contain `Bench`, `Out`, `Late`, `MIA`, or `Trial`.

Loot still comes from `LOOT_RANGE`, usually `History!A:Z`. Historical loot recipients who are not on the current Calendar roster are kept in loot history and summary, with a sync warning.

Bench suggestion rules can come from the optional `Bench Rules` tab, usually `BENCH_RULES_RANGE=Bench Rules!A:I`. The sync script quotes sheet names with spaces before calling the Google Sheets API. If the tab or range is missing, the sync warns and writes fallback rules to `src/data/benchRules.json` so the site still builds.

Expected Bench Rules columns:

- `Enabled`
- `Rule Type`
- `Player 1`
- `Player 2`
- `Class`
- `Role`
- `Min Available`
- `Weight`
- `Notes`

Enabled accepts `TRUE`, `true`, `yes`, `y`, or `1`. Disabled and blank rows are ignored. Column matching is case-insensitive and tolerant of extra spaces.

Supported player protection and hard rule types:

- `NEVER_BENCH_PLAYER`: requires `Player 1`.
- `PROGRESSION_CORE_PLAYER`: requires `Player 1`. Avoids benching that player on unprogressed bosses unless needed to satisfy hard raid rules.
- `AVOID_BENCH_TOGETHER`: requires `Player 1` and `Player 2`.
- `MIN_AVAILABLE_ROLE`: requires `Role` and `Min Available`.
- `MIN_AVAILABLE_CLASS`: requires `Class` and `Min Available`.
- `REQUIRE_ONE_PER_CLASS`: keeps at least one available player per represented class. `Min Available` can override the default of `1`.
- `PLANNING_WINDOW_WEEKS`: controls how many upcoming raid week/date ranges the Bench Suggestion output includes. Put the number in `Min Available`. The default is `8`.

Supported scoring rule types:

- `WEIGHT_LOW_BENCH_COUNT`, default weight `10`.
- `WEIGHT_NOT_RECENTLY_BENCHED`, default weight `6`.
- `PENALTY_BACK_TO_BACK_BENCH`, default weight `-8`.
- `PENALTY_RECENTLY_UNAVAILABLE`, default weight `-5`.
- `PENALTY_ADJACENT_UNAVAILABLE`, default weight `-10`.

Unavailable penalties are soft scoring penalties. They make a player less likely to be suggested when better valid candidates exist, but they do not override hard constraints. Players marked Out, Late, or MIA in the target week are still hard-excluded from new bench suggestions.

Example Bench Rules rows:

```text
Enabled | Rule Type              | Player 1  | Player 2    | Class        | Role   | Min Available | Weight | Notes
TRUE    | NEVER_BENCH_PLAYER     | Tengen    |             |              |        |               |        | Raid lead
TRUE    | PROGRESSION_CORE_PLAYER| June      |             |              |        |               |        | Avoid benching on unprogressed bosses
TRUE    | AVOID_BENCH_TOGETHER   | Drchicken | Cardinalcrzy|              |        |               |        | Avoid pairing
TRUE    | MIN_AVAILABLE_ROLE     |           |             |              | Healer | 5             |        |
TRUE    | MIN_AVAILABLE_CLASS    |           |             | Death Knight |        | 2             |        |
TRUE    | REQUIRE_ONE_PER_CLASS  |           |             |              |        | 1             |        |
TRUE    | PLANNING_WINDOW_WEEKS  |           |             |              |        | 4             |        | Generate next 4 weeks
TRUE    | WEIGHT_LOW_BENCH_COUNT |           |             |              |        |               | 10     |
TRUE    | PENALTY_RECENTLY_UNAVAILABLE |     |             |              |        |               | -5     | Avoid recent Out/Late/MIA
TRUE    | PENALTY_ADJACENT_UNAVAILABLE |     |             |              |        |               | -10    | Avoid adjacent Out/Late/MIA
```

Fallback hard rules if the tab is missing or has no valid enabled hard rules:

- Never bench `Tengen` or `Karkan`.
- Avoid benching `Drchicken` and `Cardinalcrzy` together.
- Keep at least 5 healers available.
- Keep at least 2 Death Knights, 2 Warriors, and 2 Paladins available.
- Keep at least 1 available player per represented class.

The Bench Suggestion tool is read-only. It does not write bench assignments to Google Sheets, does not call GitHub, and does not call Cloudflare Functions. It uses synced JSON to draft recommendations that officers can review and manually copy into the Calendar sheet.

Built-in Bench Suggestion behavior:

- Target raid size is 25 players.
- Active roster comes from Calendar rows.
- Out, Late, or MIA on either raid night makes the player unavailable for that week.
- Existing future Bench marks are preserved as the official current plan.
- Existing Bench marks count toward the dynamically required bench count.
- The tool fills gaps only when existing Bench marks are below the required count.
- If existing Bench marks exceed the required count, the tool warns and does not remove anyone.
- The planner only includes future raid weeks in the configured Bench Suggestion planning window, default `8`.
- `PLANNING_WINDOW_WEEKS` can shorten or lengthen the suggestion output without changing the visible Bench page schedule.
- `PENALTY_RECENTLY_UNAVAILABLE` looks back across the recent raid weeks in calendar data, currently the previous 2 raid weeks.
- `PENALTY_ADJACENT_UNAVAILABLE` checks the immediately previous and immediately next raid week/date range.
- If all raid dates in a week are in the past, that week is skipped.

### Warcraft Logs sync

Warcraft Logs sync is optional and static. It uses Warcraft Logs API v2 during the server-side WCL sync script only. No browser/client code calls Warcraft Logs directly.

The script:

- Requests an OAuth access token from `https://www.warcraftlogs.com/oauth/token` using `WCL_CLIENT_ID` and `WCL_CLIENT_SECRET`.
- Queries the Classic GraphQL endpoint at `https://classic.warcraftlogs.com/api/v2/client`.
- Reads recent guild reports for either `WCL_GUILD_SOURCES_JSON` sources or the fallback `WCL_GUILD_NAME`, `WCL_SERVER_SLUG`, and `WCL_REGION`.
- Extracts report metadata, zone data, and report fight data.
- Supplements report/fight data with WCL guild progress data when the report list misses historical progression kills.
- Writes deterministic JSON to `src/data/wclReports.json`, `src/data/wclBossAttendance.json`, `src/data/wclBossAttendanceSummary.json`, `src/data/wclGuildProgress.json`, `src/data/wclProgressionSeed.json`, and `src/data/wclRankings.json`.
- Updates `src/data/wclSyncMeta.json` only when the WCL report/progression/ranking JSON actually changes.

Generated Warcraft Logs files:

- `src/data/wclReports.json`: recent reports with fight metadata.
- `src/data/wclBossAttendance.json`: raw player attendance events for Throne of Thunder and Siege of Orgrimmar boss fights. Boss bench tools only use Siege of Orgrimmar events; Throne of Thunder is kept for historical viewing.
- `src/data/wclBossAttendanceSummary.json`: compact Siege of Orgrimmar attendance summary used by boss bench suggestions so officer API requests do not load the large raw attendance event file.
- `src/data/wclGuildProgress.json`: guild progress records used to supplement historical kills when report/fight sync is incomplete.
- `src/data/wclProgressionSeed.json`: raid/boss/difficulty seed data for progression pages.
- `src/data/wclRankings.json`: ranking data when available, or a safe null fallback when the queried API shape does not expose guild zone rankings.
- `src/data/wclSyncMeta.json`: last successful WCL data-changing sync metadata.

The report query is intentionally narrow:

```graphql
query GuildReports($guildName: String!, $serverSlug: String!, $serverRegion: String!, $limit: Int!, $page: Int!) {
  reportData {
    reports(
      guildName: $guildName
      guildServerSlug: $serverSlug
      guildServerRegion: $serverRegion
      limit: $limit
      page: $page
    ) {
      data {
        code
        title
        startTime
        endTime
        zone {
          id
          name
        }
        fights(translate: true) {
          id
          name
          encounterID
          difficulty
          kill
          bossPercentage
          fightPercentage
          startTime
          endTime
        }
      }
      total
      per_page
      current_page
      last_page
    }
  }
}
```

Boss attendance sync is stored as raw presence events instead of precomputed counts. Each row records a player, boss, date, report link, fight ID, tier, difficulty, and kill flag. The sync also writes a compact Siege of Orgrimmar summary for the boss bench API; current boss bench suggestions consume that summary so the function does not load the large raw event file. The sync only imports attendance for MoP Tier 15 and Tier 16; current boss bench suggestions only consume Tier 16.

The guild progress supplement uses WCL's `progressRaceData.progressRace` field for focused historical gaps. The current supplement is for guild `619658` and progress zone `1010`, which WCL uses for the TBC Tier 5 SSC/TK guild progress page:

```graphql
query GuildProgressRace($guildId: Int!, $zoneId: Int!, $difficulty: Int!, $size: Int!) {
  progressRaceData {
    progressRace(guildID: $guildId, zoneID: $zoneId, difficulty: $difficulty, size: $size)
  }
}
```

Assumptions:

- Warcraft Logs guild lookup uses `guildName`, `guildServerSlug`, and `guildServerRegion`.
- The default guild is `Vitality` on `raden` in `US`.
- `WCL_GUILD_SOURCES_JSON` can assign sources to expansion/tier groups. The audited mapping uses `Vitality - Raden` for MoP, `Might - Fairbanks` for Classic and early TBC, `Inept - Grobbulus` for late TBC and Wrath, and `Inept - Benediction` for Cataclysm.
- If a source includes `guildId`, the sync first tries the Warcraft Logs `reportData.reports(guildID: ...)` query. If that query is rejected or unavailable, it falls back to `guildName`, `guildServerSlug`, and `guildServerRegion`.
- When a tier appears in multiple configured sources, the sync merges those source reports into one progression result. This is intentional for split tiers such as `tbc-tier-5`.
- TBC Tier 5 also uses WCL guild progress zone `1010` for `Inept - Grobbulus` when report/fight data is missing. Guild progress confirms only boss completion data, so it supplements missing kills without replacing richer report/fight data.
- When the same raid appears from sources that are not both configured for its tier, the sync prefers configured tier sources and falls back to the newest available source only if no configured source is present.
- If one configured WCL source fails, the sync preserves existing JSON for that source when possible instead of wiping all WCL data.
- The sync reads multiple report pages per source. The default `WCL_REPORT_LIMIT=20` and `WCL_REPORT_PAGES=25` can fetch up to 500 reports per source so older tier logs are less likely to be missed.
- Report fights use report-relative fight times when they are not already epoch timestamps.
- Difficulty IDs `1`, `2`, and `3` are normalized to `Normal`; difficulty ID `4` is normalized to `Heroic`. Difficulty ID `5` is treated as `Mythic` if it ever appears, but it is not expected for current MoP Classic progression. The raw difficulty value is preserved as `rawDifficultyId`.
- Progression kill counts come from synced WCL reports and guild progress data. Configured boss lists can show unsynced bosses as `No Data`, but kills are not invented.
- The default recent report limit is `20`.

Example `.env.local` shape:

```bash
GOOGLE_SHEET_ID=your-private-sheet-id
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"..."}
CALENDAR_RANGE=Calendar!A:ZZ
LOOT_RANGE=History!A:Z
BENCH_RULES_RANGE=Bench Rules!A:I
CALENDAR_START_YEAR=2026
WCL_CLIENT_ID=your-warcraft-logs-client-id
WCL_CLIENT_SECRET=your-warcraft-logs-client-secret
WCL_GUILD_NAME=Vitality
WCL_SERVER_SLUG=raden
WCL_REGION=US
WCL_REPORT_LIMIT=20
WCL_REPORT_PAGES=25
WCL_GUILD_SOURCES_JSON=[{"guildName":"Vitality","serverSlug":"raden","region":"US","label":"Vitality - Raden","expansions":["mop"],"tiers":["tier-14","tier-15","tier-16"]},{"guildId":482914,"guildName":"Might","serverSlug":"fairbanks","region":"US","label":"Might - Fairbanks","expansions":["classic","tbc"],"tiers":["classic-mc-ony","classic-bwl","classic-aq","classic-naxx","tbc-tier-4","tbc-tier-5"]},{"guildId":619658,"guildName":"Inept","serverSlug":"grobbulus","region":"US","label":"Inept - Grobbulus","expansions":["tbc","wrath"],"tiers":["tbc-tier-5","tbc-tier-6","tbc-sunwell","wrath-tier-7","wrath-tier-8","wrath-tier-9","wrath-tier-10"]},{"guildId":738773,"guildName":"Inept","serverSlug":"benediction","region":"US","label":"Inept - Benediction","expansions":["cata"],"tiers":["cata-tier-11","cata-tier-12","cata-tier-13"]}]
```

Sources can include `guildId` when needed. MoP stays on the current `Vitality - Raden` identity for all tracked MoP tiers.

Run only Google Sheets locally:

```bash
npm run sync:sheets
```

`npm run sync:data` is kept as a sheets-only alias for existing local habits and does not run Warcraft Logs.

Run only Warcraft Logs locally:

```bash
npm run sync:wcl
```

Run both Google Sheets and Warcraft Logs locally:

```bash
npm run sync:all
```

Build after syncing:

```bash
npm run build:with-data
```

The routine Google Sheets workflow lives at `.github/workflows/sync-data.yml`. It runs every 15 minutes via UTC cron and can also be triggered manually from GitHub:

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Sync guild data**.
4. Click **Run workflow**.

The routine workflow intentionally avoids unnecessary Cloudflare builds:

- It runs `npm run sync:sheets`.
- It checks only the Google Sheets generated JSON files.
- If there are no generated JSON changes, it prints `No data changes detected.` and exits successfully.
- If there are changes, it stages and commits only the sheet-generated JSON files.
- Sheet sync metadata timestamps are updated only when the underlying generated sheet data changed. A scheduled no-change run does not update `syncMeta.json`.

Warcraft Logs archive sync lives at `.github/workflows/sync-wcl.yml`. It can be triggered manually from GitHub and runs `npm run sync:wcl`. It is separate from the routine Google Sheets sync so normal officer data refreshes do not query the historical Warcraft Logs archive.

Full sync lives at `.github/workflows/sync-all.yml`. It can be triggered manually from GitHub and runs `npm run sync:all` when both Google Sheets and Warcraft Logs should be refreshed together.

## Officer sync buttons

Officer Sync includes separate sync buttons that call the Cloudflare Pages Function at `/api/trigger-sync`. The Function verifies a password server-side and then triggers the correct GitHub Actions workflow dispatch on `feature/guild-site-mvp`.

- **Sync Guild Data** posts `syncType: "sheets"` and triggers `.github/workflows/sync-data.yml`. It refreshes roster, calendar, bench, bench rules, and loot from Google Sheets only.
- **Sync Warcraft Logs** posts `syncType: "wcl"` and triggers `.github/workflows/sync-wcl.yml`. It refreshes progression archive data only.
- The API also accepts `syncType: "all"` for `.github/workflows/sync-all.yml`, but the normal officer guild data button does not use it.

Cloudflare Pages environment variables:

- `GITHUB_ACTIONS_DISPATCH_TOKEN`: a fine-grained GitHub token for `Teng3n/vitality-mop` with Actions read/write permission.
- `SYNC_TRIGGER_PASSWORD_HASH`: preferred. SHA-256 hex hash of the password users type into the prompt.
- `SYNC_TRIGGER_PASSWORD`: plain password fallback if a hash is not configured. Keep it server-side only and migrate to `SYNC_TRIGGER_PASSWORD_HASH` when practical.

Do not put the token or password in frontend code. Do not commit them to the repo. Store them in Cloudflare Pages under the environment used by the deployed site, usually Production and Preview if both are needed.

Example hash generation:

```bash
node -e "crypto=require('node:crypto'); console.log(crypto.createHash('sha256').update(process.argv[1]).digest('hex'))" "replace-with-your-password"
```

The Function has a best-effort 60-second cooldown per running Cloudflare isolate. It returns `401` for invalid passwords and does not call GitHub unless authentication passes.

Generated files:

- `src/data/roster.json`
- `src/data/calendar.json`
- `src/data/lootHistory.json`
- `src/data/lootSummary.json`
- `src/data/bench.json`
- `src/data/benchRules.json`
- `src/data/syncMeta.json`
- `src/data/wclReports.json`
- `src/data/wclBossAttendance.json`
- `src/data/wclBossAttendanceSummary.json`
- `src/data/wclGuildProgress.json`
- `src/data/wclProgressionSeed.json`
- `src/data/wclRankings.json`
- `src/data/wclSyncMeta.json`

Troubleshooting:

- Missing `GOOGLE_SHEET_ID` or `GOOGLE_SERVICE_ACCOUNT_JSON`: add the required repository secret in GitHub.
- Missing `WCL_CLIENT_ID` or `WCL_CLIENT_SECRET`: Warcraft Logs sync is skipped and existing WCL JSON is preserved. Routine Google Sheets sync does not require WCL credentials.
- Warcraft Logs API error: check the Action logs for the safe HTTP/GraphQL error. Existing WCL JSON is preserved.
- Inaccessible sheet: confirm the sheet is shared with the service account email as Viewer.
- Wrong range: set `CALENDAR_RANGE` or `LOOT_RANGE` to the correct tab and columns.
- Missing Bench Rules tab: this is allowed. The sync uses fallback bench rules and logs a warning.
- Invalid Bench Rules row: the row is skipped with a warning. The sync does not fail because of a malformed optional rule row.
- Invalid service account JSON: store the full JSON as one GitHub secret; escaped private-key newlines are supported.
- Missing Calendar columns: the Calendar range must include Name, Class, Spec, and at least one valid raid date column.
- Missing loot columns: check the Action logs for the required History column names reported by the sync script.
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
functions/
  api/trigger-sync.ts  Cloudflare Pages Function for manual officer sync triggers
public/             Static assets and Cloudflare Pages headers
```

The only dynamic endpoint is the manual officer sync trigger in `functions/api/trigger-sync.ts`.
