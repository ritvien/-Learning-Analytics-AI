"""Load evaluation datasets from docs/12-Evaluation/."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_EVAL_DIR = _REPO_ROOT / "docs" / "12-Evaluation"


def load_test_cases(path: Path | None = None) -> list[dict[str, Any]]:
    """Load gate3 test cases JSON."""
    tc_path = path or (_EVAL_DIR / "gate3_test_cases.json")
    return json.loads(tc_path.read_text(encoding="utf-8"))


def load_golden_answers(path: Path | None = None) -> list[dict[str, Any]]:
    """Load G2 golden reference answers from results.json."""
    golden_path = path or (_EVAL_DIR / "results.json")
    return json.loads(golden_path.read_text(encoding="utf-8"))


def golden_by_tc(golden: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Index golden answers by normalized TC id (TC01, TC02, …)."""
    indexed: dict[str, dict[str, Any]] = {}
    for entry in golden:
        tc_id = entry.get("tc", "")
        normalized = tc_id if tc_id.startswith("TC0") else f"TC{tc_id.lstrip('TC').zfill(2)}"
        if tc_id.startswith("TC") and len(tc_id) == 3:
            normalized = f"TC{tc_id[2:].zfill(2)}"
        indexed[normalized] = entry
        indexed[tc_id] = entry
    return indexed
