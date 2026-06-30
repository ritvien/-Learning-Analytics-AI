"""Unit tests for LangSmith metrics parser â€” uses fake Run objects."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.eval.langsmith_metrics import (
    _compute_ttft,
    fetch_langsmith_metrics,
    parse_child_runs,
    parse_root_run,
)


def _make_run(**kwargs) -> SimpleNamespace:
    """Create a fake LangSmith Run-like object."""
    defaults = {
        "id": "run-001",
        "name": "eduinsight-chat-stream",
        "run_type": "chain",
        "status": "success",
        "error": None,
        "start_time": datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC),
        "end_time": datetime(2026, 6, 29, 10, 0, 5, tzinfo=UTC),
        "first_token_time": datetime(2026, 6, 29, 10, 0, 1, tzinfo=UTC),
        "prompt_tokens": 1200,
        "completion_tokens": 350,
        "total_tokens": 1550,
        "total_cost": 0.000678,
        "prompt_cost": 0.000240,
        "completion_cost": 0.000438,
        "extra": {
            "metrics": {
                "prompt_tokens": 1200,
                "completion_tokens": 350,
                "total_tokens": 1550,
                "total_cost": 0.000678,
                "prompt_cost": 0.000240,
                "completion_cost": 0.000438,
            },
            "prompt_token_details": {"cached_tokens": 800, "cache_creation": 200},
            "completion_token_details": {"reasoning_tokens": 50},
        },
        "session_name": "EduInsight",
        "feedback_stats": None,
        "trace_id": "trace-001",
        "url": None,
        "dotted_order": None,
        "project_name": "EduInsight",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


class TestParseRootRun:
    def test_full_metrics(self):
        run = _make_run()
        result = parse_root_run(run)

        assert result["status"] == "success"
        assert result["prompt_tokens"] == 1200
        assert result["completion_tokens"] == 350
        assert result["total_tokens"] == 1550
        assert result["total_cost"] == 0.000678
        assert result["prompt_cost"] == 0.000240
        assert result["completion_cost"] == 0.000438
        assert result["latency_ms"] == 5000  # 5 seconds
        assert result["ttft_ms"] == 1000  # 1 second
        assert result["error"] is None
        assert result["prompt_token_details"]["cached_tokens"] == 800

    def test_missing_cost_and_tokens(self):
        """When cost/tokens are zero, should return zeros cleanly."""
        run = _make_run(
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            total_cost=0,
            prompt_cost=0,
            completion_cost=0,
            extra={},
            feedback_stats=None,
        )
        result = parse_root_run(run)

        assert result["total_cost"] == 0.0
        assert result["prompt_tokens"] == 0
        assert result["completion_tokens"] == 0
        assert result["total_tokens"] == 0
        assert result["prompt_token_details"] is None

    def test_first_token_time_aware(self):
        """tz-aware first_token_time should compute TTFT correctly."""
        start = datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC)
        ftt = datetime(2026, 6, 29, 10, 0, 2, 500000, tzinfo=UTC)  # 2.5s
        run = _make_run(start_time=start, first_token_time=ftt)
        result = parse_root_run(run)

        assert result["ttft_ms"] == 2500

    def test_first_token_time_naive(self):
        """tz-naive first_token_time should still compute TTFT correctly."""
        start = datetime(2026, 6, 29, 10, 0, 0)  # naive
        ftt = datetime(2026, 6, 29, 10, 0, 3)  # naive, 3s later
        run = _make_run(start_time=start, first_token_time=ftt)
        result = parse_root_run(run)

        assert result["ttft_ms"] == 3000

    def test_mixed_timezone_ttft(self):
        """One aware, one naive â€” should normalize and compute correctly."""
        start = datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC)
        ftt = datetime(2026, 6, 29, 10, 0, 1, 200000)  # naive
        run = _make_run(start_time=start, first_token_time=ftt)
        result = parse_root_run(run)

        assert result["ttft_ms"] == 1200

    def test_no_first_token_time(self):
        """When first_token_time is None, ttft_ms should be None."""
        run = _make_run(first_token_time=None)
        result = parse_root_run(run)

        assert result["ttft_ms"] is None
        assert result["first_token_time"] is None

    def test_error_run(self):
        run = _make_run(status="error", error="LLM rate limit exceeded")
        result = parse_root_run(run)

        assert result["status"] == "error"
        assert result["error"] == "LLM rate limit exceeded"

    def test_trace_url_from_url_attribute(self):
        run = _make_run(url="https://smith.langchain.com/o/org/projects/p/EduInsight/r/run-001")
        result = parse_root_run(run)

        assert result["trace_url"] == "https://smith.langchain.com/o/org/projects/p/EduInsight/r/run-001"

    def test_trace_url_constructed(self):
        run = _make_run(url=None)
        result = parse_root_run(run)

        assert "run-001" in result["trace_url"]
        assert "EduInsight" in result["trace_url"]

    def test_feedback_stats_cost(self):
        """Cost from feedback_stats when metrics don't have it."""
        run = _make_run(
            total_cost=0,
            extra={"metrics": {}},
            feedback_stats={"total_cost": {"avg": 0.00123}},
        )
        result = parse_root_run(run)

        assert result["total_cost"] == 0.00123


class TestParseChildRuns:
    def test_tool_runs_sorted(self):
        tool1 = _make_run(
            run_type="tool",
            name="execute_sql_query",
            start_time=datetime(2026, 6, 29, 10, 0, 2, tzinfo=UTC),
            end_time=datetime(2026, 6, 29, 10, 0, 3, tzinfo=UTC),
            dotted_order="1.1",
            inputs={"query": "SELECT 1"},
            outputs={"result": [{"ok": 1}]},
        )
        tool2 = _make_run(
            run_type="tool",
            name="lookup_student_by_code",
            start_time=datetime(2026, 6, 29, 10, 0, 1, tzinfo=UTC),
            end_time=datetime(2026, 6, 29, 10, 0, 1, 500000, tzinfo=UTC),
            dotted_order="1.0",
            inputs={"student_code": "SV001"},
            outputs={"name": "Nguyen Van A"},
        )
        records = parse_child_runs([tool1, tool2])

        assert len(records) == 2
        # Should be sorted by start_time â€” tool2 first
        assert records[0]["name"] == "lookup_student_by_code"
        assert records[0]["duration_ms"] == 500
        assert records[1]["name"] == "execute_sql_query"
        assert records[1]["duration_ms"] == 1000

    def test_llm_runs_with_tokens(self):
        llm_run = _make_run(
            run_type="llm",
            name="ChatOpenAI",
            start_time=datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC),
            end_time=datetime(2026, 6, 29, 10, 0, 2, tzinfo=UTC),
            prompt_tokens=500,
            completion_tokens=100,
            total_tokens=600,
            extra={"invocation_params": {"model": "gpt-5.4-nano"}},
        )
        records = parse_child_runs([llm_run])

        assert records[0]["run_type"] == "llm"
        assert records[0]["prompt_tokens"] == 500
        assert records[0]["model"] == "gpt-5.4-nano"

    def test_mixed_runs(self):
        runs = [
            _make_run(
                run_type="llm", name="ChatOpenAI",
                start_time=datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC),
                end_time=datetime(2026, 6, 29, 10, 0, 1, tzinfo=UTC),
            ),
            _make_run(
                run_type="tool", name="execute_sql_query",
                start_time=datetime(2026, 6, 29, 10, 0, 1, tzinfo=UTC),
                end_time=datetime(2026, 6, 29, 10, 0, 2, tzinfo=UTC),
                inputs={"query": "SELECT 1"},
                outputs={"rows": 1},
            ),
            _make_run(
                run_type="llm", name="ChatOpenAI",
                start_time=datetime(2026, 6, 29, 10, 0, 2, tzinfo=UTC),
                end_time=datetime(2026, 6, 29, 10, 0, 3, tzinfo=UTC),
            ),
        ]
        records = parse_child_runs(runs)

        assert len(records) == 3
        assert records[0]["run_type"] == "llm"
        assert records[1]["run_type"] == "tool"
        assert records[2]["run_type"] == "llm"

    def test_error_tool_run(self):
        run = _make_run(
            run_type="tool",
            name="execute_sql_query",
            status="error",
            error="SQL syntax error",
            start_time=datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC),
            end_time=datetime(2026, 6, 29, 10, 0, 0, 500000, tzinfo=UTC),
            inputs={"query": "SELEC 1"},
            outputs={},
        )
        records = parse_child_runs([run])

        assert records[0]["status"] == "error"
        assert records[0]["error"] == "SQL syntax error"

    def test_naive_timestamps(self):
        run = _make_run(
            run_type="tool",
            name="test_tool",
            start_time=datetime(2026, 6, 29, 10, 0, 0),
            end_time=datetime(2026, 6, 29, 10, 0, 2),
        )
        records = parse_child_runs([run])

        assert records[0]["duration_ms"] == 2000


class TestComputeTtft:
    def test_both_aware(self):
        start = datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC)
        ftt = datetime(2026, 6, 29, 10, 0, 1, 500000, tzinfo=UTC)
        assert _compute_ttft(start, ftt) == 1500

    def test_both_naive(self):
        start = datetime(2026, 6, 29, 10, 0, 0)
        ftt = datetime(2026, 6, 29, 10, 0, 2)
        assert _compute_ttft(start, ftt) == 2000

    def test_none_ftt(self):
        start = datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC)
        assert _compute_ttft(start, None) is None

    def test_none_start(self):
        ftt = datetime(2026, 6, 29, 10, 0, 1, tzinfo=UTC)
        assert _compute_ttft(None, ftt) is None

    def test_negative_clamped_to_zero(self):
        """If ftt is before start (clock skew), return 0."""
        start = datetime(2026, 6, 29, 10, 0, 1, tzinfo=UTC)
        ftt = datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC)
        assert _compute_ttft(start, ftt) == 0


class TestFetchLangSmithMetrics:
    def test_uses_metadata_key_and_value_filter(self, monkeypatch):
        root_run = _make_run(id="root-run", trace_id="trace-root")
        child_run = _make_run(
            id="child-run",
            run_type="tool",
            name="execute_sql_query",
            inputs={"query": "SELECT 1"},
            outputs={"rows": [{"ok": 1}]},
        )
        client = MagicMock()
        client.list_runs.side_effect = [
            iter([root_run]),
            iter([child_run]),
        ]

        monkeypatch.setattr("app.eval.langsmith_metrics._make_client", lambda: client)

        result = fetch_langsmith_metrics(
            "tc-trace-id",
            project="EduInsight",
            timeout_s=1,
            poll_interval_s=0,
        )

        root_call = client.list_runs.call_args_list[0].kwargs
        assert root_call["filter"] == (
            'and(eq(metadata_key, "trace_id"), eq(metadata_value, "tc-trace-id"))'
        )
        assert root_call["is_root"] is True
        assert result["status"] == "success"
        assert result["child_runs"][0]["tool_input"] == {"query": "SELECT 1"}
