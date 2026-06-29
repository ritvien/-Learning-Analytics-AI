"""Instrument agent tools with per-call timing for evaluation metrics."""

from __future__ import annotations

import time
from typing import Any

from langchain_core.tools import BaseTool, StructuredTool

from app.eval.token_accumulator import get_run_metrics


def _record_tool_duration(tool_name: str, start: float) -> None:
    duration_ms = int((time.perf_counter() - start) * 1000)
    metrics = get_run_metrics()
    if metrics is not None:
        metrics.record_tool(tool_name, duration_ms)


def _wrap_tool_with_timing(tool: BaseTool) -> BaseTool:
    """Rebuild tool with timed func/coroutine (StructuredTool is immutable)."""
    if tool.coroutine is not None:
        original = tool.coroutine

        async def timed_coroutine(*args: Any, **kwargs: Any) -> Any:
            start = time.perf_counter()
            try:
                return await original(*args, **kwargs)
            finally:
                _record_tool_duration(tool.name, start)

        return StructuredTool(
            name=tool.name,
            description=tool.description,
            args_schema=tool.args_schema,
            func=tool.func,
            coroutine=timed_coroutine,
        )

    original_func = tool.func

    def timed_func(*args: Any, **kwargs: Any) -> Any:
        start = time.perf_counter()
        try:
            return original_func(*args, **kwargs)
        finally:
            _record_tool_duration(tool.name, start)

    return StructuredTool(
        name=tool.name,
        description=tool.description,
        args_schema=tool.args_schema,
        func=timed_func,
        coroutine=tool.coroutine,
    )


def wrap_tools_with_timing(tools: list[BaseTool]) -> list[BaseTool]:
    """Wrap each tool to record execution timing."""
    return [_wrap_tool_with_timing(t) for t in tools]
