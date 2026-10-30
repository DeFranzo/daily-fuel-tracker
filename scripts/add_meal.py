#!/usr/bin/env python3
"""Safely insert a valid meal from an owner-authored GitHub Issue."""
import json
import os
import re
from datetime import date
from pathlib import Path

START = re.compile(r"```json\s*(\{.*?\})\s*```", re.DOTALL)
ALLOWED = {"Morning", "Breakfast", "Breakfast & Lunch", "Lunch", "Afternoon", "Dinner", "Snack"}
file_path = Path("meals.json")
body = os.environ.get("ISSUE_BODY", "")
issue_number = int(os.environ["ISSUE_NUMBER"])
match = START.search(body)
if not match:
    raise ValueError("Issue body must contain a JSON code fence")
entry = json.loads(match.group(1))
if not isinstance(entry, dict) or set(entry) != {"date", "meal", "food", "breakdown", "calories", "protein"}:
    raise ValueError("Unexpected meal fields")
try:
    date.fromisoformat(entry["date"])
except (ValueError, TypeError) as exc:
    raise ValueError("Invalid ISO date") from exc
if entry["meal"] not in ALLOWED:
    raise ValueError("Invalid meal type")
for key, size in (("food", 350), ("breakdown", 6000)):
    if not isinstance(entry[key], str) or not entry[key].strip() or len(entry[key]) > size:
        raise ValueError(f"Invalid {key}")
for key, max_value in (("calories", 15000), ("protein", 500)):
    v = entry[key]
    if type(v) not in (float, int) or not 0 <= v <= max_value:
        raise ValueError(f"Invalid {key}")
with file_path.open(encoding="utf-8") as handle:
    meals = json.load(handle)
if not isinstance(meals, list):
    raise ValueError("Invalid meals.json")
if any(item.get("source_issue") == issue_number for item in meals):
    print(f"Issue #{issue_number} already logged, skipping")
    raise SystemExit(0)
entry["source_issue"] = issue_number
meals.append(entry)
meals.sort(key=lambda m: m["date"], reverse=True)
file_path.write_text(json.dumps(meals, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Logged issue #{issue_number}: {entry['date']} {entry['meal']} {entry['calories']} kcal")
