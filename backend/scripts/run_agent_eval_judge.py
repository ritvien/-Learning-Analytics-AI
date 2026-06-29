"""Judge-only pass on saved agent evaluation results."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.eval.dataset_loader import golden_by_tc, load_golden_answers, load_test_cases
from app.eval.grounding_judge import judge_grounding
from app.eval.semantic_judge import judge_semantic
from scripts.run_evaluation import (
    DEFAULT_OUTPUT_DIR,
    aggregate_metrics,
    generate_agent_eval_markdown,
    score_all,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


async def run_judge_pass(
    test_cases: list,
    results: list,
    golden_index: dict,
) -> dict:
    judge_results = {}
    for tc, result in zip(test_cases, results, strict=True):
        if result.get("status") != "OK":
            continue
        tc_id = tc["tc"]
        golden = golden_index.get(tc_id, {})
        tool_out = "\n".join(str(t.get("tool_output", "")) for t in result.get("tool_calls", []))
        sem = await judge_semantic(tc["input"], result["response"], golden.get("response", ""), tool_out)
        ground = await judge_grounding(result["response"], tool_out)
        judge_results[tc_id] = {"semantic": sem, "grounding": ground}
        logger.info("  Judged %s: semantic=%.2f grounding=%.2f", tc_id, sem["normalized_score"], ground["faithfulness"])
    return judge_results


def main() -> None:
    parser = argparse.ArgumentParser(description="LLM judge pass on saved eval results")
    parser.add_argument(
        "--input",
        default=str(DEFAULT_OUTPUT_DIR / "agent_eval_results.json"),
        help="Path to agent_eval_results.json",
    )
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        logger.error("Input file not found: %s", input_path)
        sys.exit(1)

    raw = json.loads(input_path.read_text(encoding="utf-8"))
    results = raw["results"]
    test_cases = load_test_cases()
    golden_index = golden_by_tc(load_golden_answers())

    logger.info("Running LLM judges on %d results...", len(results))
    judge_results = asyncio.run(run_judge_pass(test_cases, results, golden_index))

    scored = score_all(test_cases, results, judge_results)
    aggregates = aggregate_metrics(scored)

    output_dir = Path(args.output_dir)
    raw["scores"] = scored
    raw["aggregates"] = aggregates
    raw["with_judge"] = True
    raw["judge_results"] = judge_results

    out_json = output_dir / "agent_eval_results.json"
    out_json.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Updated %s", out_json)

    md = generate_agent_eval_markdown(test_cases, results, scored, aggregates)
    (output_dir / "agent_eval_metrics.md").write_text(md, encoding="utf-8")
    logger.info("Updated agent_eval_metrics.md")


if __name__ == "__main__":
    main()
