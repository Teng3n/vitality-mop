"""Convert selected public workbook tabs into the site's JSON data files.

Usage:
    python scripts/backfill_from_workbook.py "C:/path/to/Inept - MoP.xlsx"

The converter intentionally ignores raw form-response tabs and private-ish
columns such as notes, owner, gear comparisons, emails, and comments.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, time
from pathlib import Path
from typing import Any

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"


CLASS_ROLES = {
    "DEATHKNIGHT": "Unassigned",
    "DRUID": "Unassigned",
    "HUNTER": "Ranged DPS",
    "MAGE": "Ranged DPS",
    "MONK": "Unassigned",
    "PALADIN": "Unassigned",
    "PRIEST": "Unassigned",
    "ROGUE": "Melee DPS",
    "SHAMAN": "Unassigned",
    "WARLOCK": "Ranged DPS",
    "WARRIOR": "Unassigned",
}


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    return text


def clean_item(value: Any) -> str:
    text = clean_text(value)
    return re.sub(r"^\[(.*)\]$", r"\1", text)


def as_int(value: Any) -> int:
    if value in (None, ""):
        return 0
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def as_date(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = clean_text(value)
    if not text:
        return ""
    return text.split(" ")[0]


def write_json(name: str, rows: Any) -> None:
    path = DATA_DIR / name
    path.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sheet_rows(ws: Any) -> list[list[Any]]:
    return [list(row) for row in ws.iter_rows(values_only=True) if any(cell not in (None, "") for cell in row)]


def build_loot_summary(wb: Any) -> list[dict[str, Any]]:
    bonus_counts = Counter()
    for row in sheet_rows(wb["BonusRolls"])[1:]:
        player = clean_text(row[0] if len(row) > 0 else "")
        if player:
            bonus_counts[player.lower()] += 1

    rows = []
    for row in sheet_rows(wb["Sheet46"])[1:]:
        player = clean_text(row[2] if len(row) > 2 else "")
        if not player:
            continue
        rows.append(
            {
                "player": player,
                "bis": as_int(row[3] if len(row) > 3 else 0),
                "major": as_int(row[4] if len(row) > 4 else 0),
                "minor": as_int(row[5] if len(row) > 5 else 0),
                "offspec": as_int(row[7] if len(row) > 7 else 0),
                "bonusRolls": bonus_counts[player.lower()],
                "total": as_int(row[6] if len(row) > 6 else 0),
            }
        )
    return sorted(rows, key=lambda row: (-row["total"], row["player"].lower()))


def build_loot_history(wb: Any) -> tuple[list[dict[str, Any]], dict[str, str]]:
    rows = sheet_rows(wb["History-MoP-P1"])
    headers = [clean_text(value) for value in rows[0]]
    index = {header: pos for pos, header in enumerate(headers)}
    class_counts: dict[str, Counter[str]] = defaultdict(Counter)
    history = []

    for row in rows[1:]:
        player = clean_text(row[index["player"]])
        item = clean_item(row[index["item"]])
        if not player or not item:
            continue

        player_class = clean_text(row[index["class"]]).title()
        if player_class:
            class_counts[player][player_class] += 1

        history.append(
            {
                "date": as_date(row[index["date"]]),
                "player": player,
                "item": item,
                "boss": clean_text(row[index["boss"]]),
                "instance": clean_text(row[index["instance"]]),
                "type": clean_text(row[index["response"]]),
            }
        )

    class_by_player = {
        player: counts.most_common(1)[0][0]
        for player, counts in class_counts.items()
        if counts
    }
    history.sort(key=lambda row: (row["date"], row["player"].lower(), row["item"].lower()), reverse=True)
    return history, class_by_player


def build_roster(loot_summary: list[dict[str, Any]], class_by_player: dict[str, str]) -> list[dict[str, str]]:
    roster = []
    for row in loot_summary:
        player = row["player"]
        player_class = class_by_player.get(player, "Unknown")
        role = CLASS_ROLES.get(player_class.replace(" ", "").upper(), "Unassigned")
        roster.append(
            {
                "character": player,
                "class": player_class,
                "spec": "TBD",
                "role": role,
                "status": "Active",
            }
        )
    return sorted(roster, key=lambda row: (row["role"], row["character"].lower()))


def build_bench(wb: Any) -> list[dict[str, Any]]:
    rows = sheet_rows(wb["Bench"])
    header = rows[0]
    week_cols = [
        (pos, clean_text(value))
        for pos, value in enumerate(header)
        if clean_text(value).lower().startswith("week")
    ]
    bench = []
    for row in rows[2:]:
        player = clean_text(row[2] if len(row) > 2 else "")
        total = as_int(row[1] if len(row) > 1 else 0)
        if not player or not total:
            continue
        marked = [label for pos, label in week_cols if len(row) > pos and clean_text(row[pos]).upper() == "X"]
        bench.append(
            {
                "player": player,
                "totalBenchCount": total,
                "lastBenched": marked[-1] if marked else "",
                "notes": "Public rotation summary",
            }
        )
    return sorted(bench, key=lambda row: (-row["totalBenchCount"], row["player"].lower()))


def stage_progress(value: Any, required: int | None = None) -> tuple[int, int]:
    if isinstance(value, bool):
        return (1 if value else 0, 1)
    count = as_int(value)
    if required is None:
        required = max(count, 1)
    return (min(count, required), required)


def build_track_progress(wb: Any, sheet_name: str, track: str, stage_requirements: dict[str, int]) -> list[dict[str, Any]]:
    rows = sheet_rows(wb[sheet_name])
    players = []
    seen_players = set()
    for offset, value in enumerate(rows[0][1:], start=1):
        player = clean_text(value)
        if not player or player.lower() in seen_players:
            continue
        players.append((offset, player))
        seen_players.add(player.lower())
    output = []

    for offset, player in players:
        completed = 0
        required = 0
        next_stage = "Complete"
        for row in rows[1:]:
            stage = clean_text(row[0] if row else "")
            if not stage or stage not in stage_requirements:
                continue
            stage_done, stage_required = stage_progress(row[offset] if len(row) > offset else None, stage_requirements[stage])
            completed += stage_done
            required += stage_required
            if next_stage == "Complete" and stage_done < stage_required:
                next_stage = stage
        if required:
            output.append(
                {
                    "player": player,
                    "track": track,
                    "stage": next_stage,
                    "completed": completed,
                    "required": required,
                    "status": "Complete" if completed >= required else "Active",
                }
            )

    return output


def build_legendary_progress(wb: Any) -> list[dict[str, Any]]:
    staff = build_track_progress(
        wb,
        "Staff Progress",
        "Staff",
        {
            "25 Eternal Embers": 25,
            "Solo Nexus Quests": 1,
            "Anvil of Conflag Raid Quest": 1,
            "1000 Seething Cinders": 1000,
            "250 Smouldering Essences": 250,
            "Ragnaros Heart of Flame": 1,
        },
    )
    daggers = build_track_progress(
        wb,
        "Dagger Progress",
        "Daggers",
        {
            "Pickpocket Hagara": 1,
            "Solo Quests 1 - First Daggers": 1,
            "333 Shadowy Gems": 333,
            "Solo Quests 2 - Second Daggers": 1,
            "60 Elementium Gem Clusters": 60,
            "Fragment of Deathwing's Jaw": 1,
        },
    )
    return sorted(staff + daggers, key=lambda row: (row["track"], row["status"], row["player"].lower()))


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/backfill_from_workbook.py <workbook.xlsx>")

    workbook_path = Path(sys.argv[1])
    wb = openpyxl.load_workbook(workbook_path, data_only=True)

    loot_summary = build_loot_summary(wb)
    loot_history, class_by_player = build_loot_history(wb)
    roster = build_roster(loot_summary, class_by_player)
    bench = build_bench(wb)
    legendary_progress = build_legendary_progress(wb)

    write_json("lootSummary.json", loot_summary)
    write_json("lootHistory.json", loot_history)
    write_json("roster.json", roster)
    write_json("bench.json", bench)
    write_json("legendaryProgress.json", legendary_progress)

    print(
        json.dumps(
            {
                "roster": len(roster),
                "lootSummary": len(loot_summary),
                "lootHistory": len(loot_history),
                "bench": len(bench),
                "legendaryProgress": len(legendary_progress),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
