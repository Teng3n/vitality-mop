# Warcraft Logs Guild History Audit

Status: Not run.

WCL_CLIENT_ID and WCL_CLIENT_SECRET were not available in this environment. No Warcraft Logs API requests were made.

Configured guild IDs: 482914, 619658, 738773
Current guild source: Vitality - Raden (Vitality on raden, US)

## Summary by Guild ID

| Guild ID | Guild name | Server/realm | Region | Earliest report | Latest report | Expansions found | Report count | Zones found |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vitality - Raden | Vitality | Raden | US | Not run | Not run | Unknown | 0 | None |
| 482914 | Unknown | Unknown | Unknown | Not run | Not run | Unknown | 0 | None |
| 619658 | Unknown | Unknown | Unknown | Not run | Not run | Unknown | 0 | None |
| 738773 | Unknown | Unknown | Unknown | Not run | Not run | Unknown | 0 | None |

## Recommended WCL_GUILD_SOURCES_JSON

No source mapping can be recommended until the audit is run with Warcraft Logs credentials.

```json
[]
```

## Gaps

Audit not run. Run with Warcraft Logs credentials to identify expansion and tier gaps.

Run this command in an environment with WCL_CLIENT_ID and WCL_CLIENT_SECRET:

```bash
npm run audit:wcl-guild-history
```
