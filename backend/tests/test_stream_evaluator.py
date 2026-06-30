"""Unit tests for the SSE stream evaluator parser."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.run_evaluation import _load_local_env, _parse_sse_line


class TestParseSSELine:
    def test_token_event(self):
        line = 'data: {"type": "token", "content": "Xin chào"}'
        event = _parse_sse_line(line)
        assert event["type"] == "token"
        assert event["content"] == "Xin chào"

    def test_router_event(self):
        line = 'data: {"type": "router", "intent": "core_agent", "intent_category": "data_query", "complexity": "medium"}'
        event = _parse_sse_line(line)
        assert event["type"] == "router"
        assert event["intent"] == "core_agent"
        assert event["intent_category"] == "data_query"

    def test_route_decision_event(self):
        rd = {"mode": "core", "target_route": "core_agent", "reason": "complex query"}
        line = f'data: {json.dumps({"type": "route_decision", "route_decision": rd})}'
        event = _parse_sse_line(line)
        assert event["type"] == "route_decision"
        assert event["route_decision"]["mode"] == "core"

    def test_tool_call_event(self):
        line = 'data: {"type": "tool_call", "tool": "execute_sql_query", "input": {"query": "SELECT 1"}}'
        event = _parse_sse_line(line)
        assert event["type"] == "tool_call"
        assert event["tool"] == "execute_sql_query"

    def test_tool_result_event(self):
        line = 'data: {"type": "tool_result", "output": "[{\\"ok\\": 1}]"}'
        event = _parse_sse_line(line)
        assert event["type"] == "tool_result"

    def test_done_event(self):
        line = 'data: {"type": "done", "latency_ms": 5000, "thread_id": "abc-123"}'
        event = _parse_sse_line(line)
        assert event["type"] == "done"
        assert event["latency_ms"] == 5000

    def test_error_event(self):
        line = 'data: {"type": "error", "message": "LLM rate limit"}'
        event = _parse_sse_line(line)
        assert event["type"] == "error"
        assert event["message"] == "LLM rate limit"

    def test_session_created_event(self):
        line = 'data: {"type": "session_created", "thread_id": "ses-001", "title": "Test"}'
        event = _parse_sse_line(line)
        assert event["type"] == "session_created"
        assert event["thread_id"] == "ses-001"

    def test_guardrail_event(self):
        line = 'data: {"type": "guardrail", "decision": "safety", "trace_source": "guardrail_pre_llm"}'
        event = _parse_sse_line(line)
        assert event["type"] == "guardrail"
        assert event["trace_source"] == "guardrail_pre_llm"

    def test_empty_line(self):
        assert _parse_sse_line("") is None

    def test_non_data_line(self):
        assert _parse_sse_line("event: keepalive") is None

    def test_invalid_json(self):
        assert _parse_sse_line("data: not-json") is None

    def test_whitespace_stripped(self):
        line = '  data: {"type": "token", "content": "hi"}  '
        event = _parse_sse_line(line)
        assert event["type"] == "token"


class TestSSEResponseAssembly:
    """Test that token chunks assemble into a complete response."""

    def test_assemble_tokens(self):
        lines = [
            'data: {"type": "router", "intent": "core_agent"}',
            'data: {"type": "token", "content": "GPA "}',
            'data: {"type": "token", "content": "trung bình "}',
            'data: {"type": "token", "content": "là **2.275**."}',
            'data: {"type": "done", "latency_ms": 3000, "thread_id": "t-1"}',
        ]
        events = [_parse_sse_line(line) for line in lines]
        events = [e for e in events if e is not None]

        # Reconstruct the response
        response_chunks = [e["content"] for e in events if e.get("type") == "token"]
        full_response = "".join(response_chunks)

        assert full_response == "GPA trung bình là **2.275**."

    def test_tool_call_and_result_paired(self):
        lines = [
            'data: {"type": "tool_call", "tool": "execute_sql_query", "input": {"query": "SELECT 1"}}',
            'data: {"type": "tool_result", "output": "[{\\"ok\\": 1}]"}',
            'data: {"type": "tool_call", "tool": "lookup_student_by_code", "input": {"student_code": "SV001"}}',
            'data: {"type": "tool_result", "output": "{\\"name\\": \\"Nguyen Van A\\"}"}',
        ]
        events = [_parse_sse_line(line) for line in lines]
        events = [e for e in events if e is not None]

        # Simulate pairing logic from run_test_case_stream
        tool_calls = []
        pending = None
        for event in events:
            if event["type"] == "tool_call":
                pending = {
                    "tool_name": event.get("tool", "unknown"),
                    "tool_input": event.get("input", {}),
                    "tool_output": "",
                }
            elif event["type"] == "tool_result" and pending:
                pending["tool_output"] = event.get("output", "")
                tool_calls.append(pending)
                pending = None

        assert len(tool_calls) == 2
        assert tool_calls[0]["tool_name"] == "execute_sql_query"
        assert tool_calls[1]["tool_name"] == "lookup_student_by_code"

    def test_error_event_sets_status(self):
        lines = [
            'data: {"type": "router", "intent": "core_agent"}',
            'data: {"type": "error", "message": "LLM provider error"}',
        ]
        events = [_parse_sse_line(line) for line in lines]
        events = [e for e in events if e is not None]

        # Simulate status tracking
        status = "OK"
        error_msg = None
        for event in events:
            if event["type"] == "error":
                status = "ERROR"
                error_msg = event.get("message")

        assert status == "ERROR"
        assert error_msg == "LLM provider error"

    def test_error_does_not_crash_batch(self):
        """Multiple TCs — one error should not affect others."""
        batch_lines = [
            # TC1 - success
            [
                'data: {"type": "token", "content": "OK response"}',
                'data: {"type": "done", "latency_ms": 1000}',
            ],
            # TC2 - error
            [
                'data: {"type": "error", "message": "timeout"}',
            ],
            # TC3 - success
            [
                'data: {"type": "token", "content": "Another OK"}',
                'data: {"type": "done", "latency_ms": 2000}',
            ],
        ]

        results = []
        for tc_lines in batch_lines:
            events = [_parse_sse_line(line) for line in tc_lines]
            events = [e for e in events if e is not None]

            status = "OK"
            response = ""
            for event in events:
                if event["type"] == "token":
                    response += event.get("content", "")
                elif event["type"] == "error":
                    status = "ERROR"

            results.append({"status": status, "response": response})

        assert results[0]["status"] == "OK"
        assert results[0]["response"] == "OK response"
        assert results[1]["status"] == "ERROR"
        assert results[2]["status"] == "OK"
        assert results[2]["response"] == "Another OK"


class TestEnvLoading:
    def test_load_local_env_sets_langsmith_without_overriding(self, tmp_path, monkeypatch):
        env_path = tmp_path / ".env"
        env_path.write_text(
            "\n".join(
                [
                    "LANGSMITH_API_KEY=from-file",
                    "LANGSMITH_PROJECT=EduInsight",
                    "LANGSMITH_TRACING=true",
                ]
            ),
            encoding="utf-8",
        )
        monkeypatch.delenv("LANGSMITH_PROJECT", raising=False)
        monkeypatch.delenv("LANGSMITH_TRACING", raising=False)
        monkeypatch.setenv("LANGSMITH_API_KEY", "from-shell")

        _load_local_env(env_path)

        assert os.environ["LANGSMITH_API_KEY"] == "from-shell"
        assert os.environ["LANGSMITH_PROJECT"] == "EduInsight"
        assert os.environ["LANGSMITH_TRACING"] == "true"
