"""Convert the trimmed MoP workbook into the site's public JSON files.

Usage:
    python scripts/backfill_from_workbook.py "C:/path/to/Copy of Inept - MoP.xlsx"

The reduced workbook source of truth is:
    - Calendar: roster and player-level loot/bench totals
    - History: public loot award history
    - Bench: public bench schedule

The converter intentionally ignores private-ish History columns such as notes,
owner, raw item strings, gear comparisons, votes, and IDs.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"

ROLE_CODES = {
    "T": "Tank",
    "H": "Healer",
    "M": "Melee DPS",
    "R": "Ranged DPS",
}

CLASS_ROLES = {
    "Deathknight": "Unassigned",
    "Druid": "Unassigned",
    "Hunter": "Ranged DPS",
    "Mage": "Ranged DPS",
    "Monk": "Unassigned",
    "Paladin": "Unassigned",
    "Priest": "Unassigned",
    "Rogue": "Melee DPS",
    "Shaman": "Unassigned",
    "Warlock": "Ranged DPS",
    "Warrior": "Unassigned",
}

ROSTER_DETAILS = {
    "Arrowqt": ("Hunter", "Survival", "Ranged DPS"),
    "Aurumai": ("Shaman", "Elemental", "Ranged DPS"),
    "Bannedpex": ("Druid", "Feral", "Melee DPS"),
    "Cabbage": ("Warlock", "Affliction", "Ranged DPS"),
    "Cardinalcrzy": ("Priest", "Discipline", "Healer"),
    "Chonkars": ("Warrior", "Arcane", "Unassigned"),
    "Deéz": ("Death Knight", "Unholy", "Melee DPS"),
    "Drchicken": ("Priest", "Discipline", "Healer"),
    "Fae": ("Paladin", "Holy", "Healer"),
    "Foggy": ("Warlock", "Affliction", "Ranged DPS"),
    "Imincolombia": ("Monk", "Mistweaver", "Healer"),
    "June": ("Monk", "Windwalker", "Melee DPS"),
    "Kaiysz": ("Paladin", "Retribution", "Melee DPS"),
    "Kali": ("Warrior", "Arms", "Melee DPS"),
    "Karkan": ("Paladin", "Protection", "Tank"),
    "Kubara": ("Shaman", "Elemental", "Ranged DPS"),
    "Kuradelh": ("Hunter", "Survival", "Ranged DPS"),
    "Lexou": ("Shaman", "Enhancement", "Melee DPS"),
    "Marz": ("Mage", "Fire", "Ranged DPS"),
    "Maverickdog": ("Hunter", "Survival", "Ranged DPS"),
    "Nagafish": ("Rogue", "Subtlety", "Melee DPS"),
    "Noctuahati": ("Druid", "Balance", "Ranged DPS"),
    "Noxw": ("Warrior", "Arms", "Melee DPS"),
    "Oswaldmosley": ("Death Knight", "Unholy", "Melee DPS"),
    "Runicbeard": ("Death Knight", "Frost", "Melee DPS"),
    "Shrynx": ("Mage", "Fire", "Ranged DPS"),
    "Teehee": ("Mage", "Fire", "Ranged DPS"),
    "Tengen": ("Warrior", "Protection", "Tank"),
    "Volkswórgen": ("Rogue", "Subtlety", "Melee DPS"),
    "Yellock": ("Warlock", "Affliction", "Ranged DPS"),
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
    return text.split(" ")[0] if text else ""


def write_json(name: str, rows: Any) -> None:
    (DATA_DIR / name).write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def nonempty_rows(ws: Any) -> list[list[Any]]:
    return [list(row) for row in ws.iter_rows(values_only=True) if any(cell not in (None, "") for cell in row)]


def header_index(headers: list[Any]) -> dict[str, int]:
    return {clean_text(header): index for index, header in enumerate(headers) if clean_text(header)}


def find_header_row(rows: list[list[Any]], required: set[str]) -> tuple[int, dict[str, int]]:
    for row_index, row in enumerate(rows):
        index = header_index(row)
        if required.issubset(index):
            return row_index, index
    raise ValueError(f"Could not find header row with {sorted(required)}")


def build_history(wb: Any) -> tuple[list[dict[str, str]], dict[str, str]]:
    rows = nonempty_rows(wb["History"])
    index = header_index(rows[0])
    required = {"player", "date", "item", "response", "class", "instance", "boss"}
    missing = sorted(required - set(index))
    if missing:
        raise ValueError(f"History sheet missing columns: {missing}")

    class_counts: dict[str, Counter[str]] = defaultdict(Counter)
    history = []

    for row in rows[1:]:
        player = clean_text(row[index["player"]] if len(row) > index["player"] else "")
        item = clean_item(row[index["item"]] if len(row) > index["item"] else "")
        if not player or not item:
            continue

        player_class = clean_text(row[index["class"]] if len(row) > index["class"] else "").title()
        if player_class:
            class_counts[player][player_class] += 1

        history.append(
            {
                "date": as_date(row[index["date"]] if len(row) > index["date"] else ""),
                "player": player,
                "item": item,
                "boss": clean_text(row[index["boss"]] if len(row) > index["boss"] else ""),
                "instance": clean_text(row[index["instance"]] if len(row) > index["instance"] else ""),
                "type": clean_text(row[index["response"]] if len(row) > index["response"] else ""),
            }
        )

    class_by_player = {
        player: counts.most_common(1)[0][0]
        for player, counts in class_counts.items()
        if counts
    }
    history.sort(key=lambda row: (row["date"], row["player"].lower(), row["item"].lower()), reverse=True)
    return history, class_by_player


def build_calendar_rows(wb: Any) -> list[dict[str, Any]]:
    rows = nonempty_rows(wb["Calendar"])
    header_row, index = find_header_row(rows, {"Name", "BiS", "Ma", "Mi", "#", "OS"})
    output = []

    for row in rows[header_row + 1 :]:
        player = clean_text(row[index["Name"]] if len(row) > index["Name"] else "")
        if not player:
            continue
        output.append(
            {
                "player": player,
                "roleCode": clean_text(row[index.get("R", -1)] if len(row) > index.get("R", 999) else ""),
                "spec": clean_text(row[index.get("S", -1)] if len(row) > index.get("S", 999) else ""),
                "bis": as_int(row[index["BiS"]] if len(row) > index["BiS"] else 0),
                "major": as_int(row[index["Ma"]] if len(row) > index["Ma"] else 0),
                "minor": as_int(row[index["Mi"]] if len(row) > index["Mi"] else 0),
                "total": as_int(row[index["#"]] if len(row) > index["#"] else 0),
                "bonusRolls": as_int(row[index.get("🎲", -1)] if len(row) > index.get("🎲", 999) else 0),
                "offspec": as_int(row[index["OS"]] if len(row) > index["OS"] else 0),
                "benchTotal": as_int(row[index.get("Bench", -1)] if len(row) > index.get("Bench", 999) else 0),
            }
        )

    return output


def build_loot_summary(calendar_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = [
        {
            "player": row["player"],
            "bis": row["bis"],
            "major": row["major"],
            "minor": row["minor"],
            "offspec": row["offspec"],
            "bonusRolls": row["bonusRolls"],
            "total": row["total"],
        }
        for row in calendar_rows
    ]
    return sorted(rows, key=lambda row: (-row["total"], row["player"].lower()))


def build_roster(calendar_rows: list[dict[str, Any]], class_by_player: dict[str, str]) -> list[dict[str, str]]:
    roster = []
    for row in calendar_rows:
        player = row["player"]
        player_class, spec, role = ROSTER_DETAILS.get(
            player,
            (
                class_by_player.get(player, "Unknown"),
                row["spec"] or "TBD",
                ROLE_CODES.get(row["roleCode"].upper()) or CLASS_ROLES.get(class_by_player.get(player, "Unknown"), "Unassigned"),
            ),
        )
        roster.append(
            {
                "character": player,
                "class": player_class,
                "spec": spec,
                "role": role,
            }
        )
    return sorted(roster, key=lambda row: row["character"].casefold())


def build_bench(wb: Any, calendar_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = nonempty_rows(wb["Bench"])
    date_row = next((row for row in rows if any(isinstance(cell, (datetime, date)) for cell in row)), [])
    schedule: dict[str, list[str]] = defaultdict(list)

    for row in rows:
        if row is date_row:
            continue
        for index, value in enumerate(row):
            player = clean_text(value)
            if not player or player == "Bench Schedule":
                continue
            bench_date = as_date(date_row[index]) if index < len(date_row) else ""
            if bench_date:
                schedule[player].append(bench_date)

    calendar_counts = {row["player"]: row["benchTotal"] for row in calendar_rows}
    players = sorted(set(calendar_counts) | set(schedule), key=str.lower)
    bench_rows = []

    for player in players:
        dates = sorted(set(schedule.get(player, [])))
        total = calendar_counts.get(player, 0) or len(dates)
        if total <= 0 and not dates:
            continue
        bench_rows.append(
            {
                "player": player,
                "totalBenchCount": total,
                "lastBenched": dates[-1] if dates else "",
                "notes": f"Scheduled: {', '.join(dates)}" if dates else "No upcoming bench date listed",
            }
        )

    return sorted(bench_rows, key=lambda row: (-row["totalBenchCount"], row["player"].lower()))


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/backfill_from_workbook.py <workbook.xlsx>")

    wb = openpyxl.load_workbook(Path(sys.argv[1]), data_only=True)

    history, class_by_player = build_history(wb)
    calendar_rows = build_calendar_rows(wb)

    write_json("lootHistory.json", history)
    write_json("lootSummary.json", build_loot_summary(calendar_rows))
    write_json("roster.json", build_roster(calendar_rows, class_by_player))
    write_json("bench.json", build_bench(wb, calendar_rows))
    print(
        json.dumps(
            {
                "roster": len(calendar_rows),
                "lootSummary": len(calendar_rows),
                "lootHistory": len(history),
                "bench": len(build_bench(wb, calendar_rows)),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
