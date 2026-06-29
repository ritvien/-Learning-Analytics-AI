"""LangChain callback to accumulate token usage and LLM call timing per agent run."""

from __future__ import annotations

import time
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from typing import Any

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

# Default pricing for gpt-5.4-nano (USD per token)
DEFAULT_PRICING: dict[str, dict[str, float]] = {
    "gpt-5.4-nano": {
        "input_per_million": 0.20,
        "output_per_million": 1.25,
    },
}


@dataclass
class LLMCallRecord:
    """One LLM invocation within an agent run."""

    step: str
    duration_ms: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    model: str = ""


@dataclass
class ToolCallRecord:
    """One tool invocation within an agent run."""

    tool_name: str
    duration_ms: int
    sequence: int


@dataclass
class AgentRunMetrics:
    """Aggregated runtime metrics for a single chat/agent invocation."""

    llm_calls: list[LLMCallRecord] = field(default_factory=list)
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    _tool_sequence: int = 0
    router_ms: int = 0
    core_ms: int = 0
    fast_ms: int = 0

    def record_llm(
        self,
        step: str,
        duration_ms: int,
        prompt_tokens: int,
        completion_tokens: int,
        model: str = "",
    ) -> None:
        total = prompt_tokens + completion_tokens
        self.llm_calls.append(
            LLMCallRecord(
                step=step,
                duration_ms=duration_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total,
                model=model,
            )
        )
        if step == "router":
            self.router_ms += duration_ms
        elif step.startswith("core"):
            self.core_ms += duration_ms
        elif step == "fast_response":
            self.fast_ms += duration_ms

    def record_tool(self, tool_name: str, duration_ms: int) -> int:
        self._tool_sequence += 1
        seq = self._tool_sequence
        self.tool_calls.append(
            ToolCallRecord(tool_name=tool_name, duration_ms=duration_ms, sequence=seq)
        )
        return seq

    @property
    def prompt_tokens(self) -> int:
        return sum(c.prompt_tokens for c in self.llm_calls)

    @property
    def completion_tokens(self) -> int:
        return sum(c.completion_tokens for c in self.llm_calls)

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    @property
    def tools_ms(self) -> int:
        return sum(c.duration_ms for c in self.tool_calls)

    @property
    def llm_ms(self) -> int:
        return sum(c.duration_ms for c in self.llm_calls)

    def cost_usd(self, model: str = "gpt-5.4-nano") -> float:
        pricing = DEFAULT_PRICING.get(model, DEFAULT_PRICING["gpt-5.4-nano"])
        input_price = pricing["input_per_million"] / 1_000_000
        output_price = pricing["output_per_million"] / 1_000_000
        return self.prompt_tokens * input_price + self.completion_tokens * output_price

    def to_usage_dict(self, model: str = "gpt-5.4-nano") -> dict[str, Any]:
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "cost_usd": round(self.cost_usd(model), 6),
            "by_step": [
                {
                    "step": c.step,
                    "prompt_tokens": c.prompt_tokens,
                    "completion_tokens": c.completion_tokens,
                    "duration_ms": c.duration_ms,
                    "model": c.model,
                }
                for c in self.llm_calls
            ],
        }

    def to_latency_breakdown(self, total_ms: int) -> dict[str, Any]:
        tools_breakdown = [
            {"tool_name": c.tool_name, "duration_ms": c.duration_ms, "sequence": c.sequence}
            for c in self.tool_calls
        ]
        overhead = max(0, total_ms - self.llm_ms - self.tools_ms)
        return {
            "router_ms": self.router_ms,
            "core_ms": self.core_ms,
            "fast_ms": self.fast_ms,
            "llm_ms": self.llm_ms,
            "tools_ms": self.tools_ms,
            "tools": tools_breakdown,
            "overhead_ms": overhead,
            "total_ms": total_ms,
        }


_current_run_metrics: ContextVar[AgentRunMetrics | None] = ContextVar(
    "current_run_metrics", default=None
)


def get_run_metrics() -> AgentRunMetrics | None:
    """Return metrics for the current async context, if any."""
    return _current_run_metrics.get()


def set_run_metrics(metrics: AgentRunMetrics) -> Token:
    """Attach run metrics to the current context."""
    return _current_run_metrics.set(metrics)


def reset_run_metrics(token: Token) -> None:
    """Restore previous context after a run."""
    _current_run_metrics.reset(token)


class TokenUsageAccumulator(BaseCallbackHandler):
    """LangChain callback that records token usage and duration per LLM call."""

    def __init__(self, step: str = "unknown") -> None:
        super().__init__()
        self.step = step
        self._start: float = 0.0
        self.model: str = ""

    def on_llm_start(self, serialized: dict[str, Any], prompts: list[str], **kwargs: Any) -> None:
        self._start = time.perf_counter()
        if serialized:
            self.model = serialized.get("kwargs", {}).get("model_name", "") or serialized.get("id", [""])[-1]

    def on_chat_model_start(self, serialized: dict[str, Any], messages: list, **kwargs: Any) -> None:
        self.on_llm_start(serialized, [], **kwargs)

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        duration_ms = int((time.perf_counter() - self._start) * 1000)
        prompt_tokens = 0
        completion_tokens = 0
        model = self.model

        if response.llm_output:
            usage = response.llm_output.get("token_usage") or {}
            prompt_tokens = int(usage.get("prompt_tokens", 0) or 0)
            completion_tokens = int(usage.get("completion_tokens", 0) or 0)
            model = response.llm_output.get("model_name", model) or model

        if not prompt_tokens and response.generations:
            for gen_list in response.generations:
                for gen in gen_list:
                    meta = getattr(gen, "message", None)
                    if meta and hasattr(meta, "usage_metadata") and meta.usage_metadata:
                        um = meta.usage_metadata
                        prompt_tokens = int(getattr(um, "input_tokens", 0) or um.get("input_tokens", 0))
                        completion_tokens = int(getattr(um, "output_tokens", 0) or um.get("output_tokens", 0))
                    elif hasattr(gen, "generation_info") and gen.generation_info:
                        usage = gen.generation_info.get("token_usage", {})
                        prompt_tokens = int(usage.get("prompt_tokens", 0) or 0)
                        completion_tokens = int(usage.get("completion_tokens", 0) or 0)

        metrics = get_run_metrics()
        if metrics is not None:
            metrics.record_llm(self.step, duration_ms, prompt_tokens, completion_tokens, model)


def _parse_usage_from_message(message: Any) -> tuple[int, int, str]:
    """Extract token counts from a LangChain AIMessage response."""
    prompt_tokens = 0
    completion_tokens = 0
    model = ""

    usage_metadata = getattr(message, "usage_metadata", None)
    if usage_metadata:
        if isinstance(usage_metadata, dict):
            prompt_tokens = int(
                usage_metadata.get("input_tokens")
                or usage_metadata.get("prompt_tokens")
                or 0
            )
            completion_tokens = int(
                usage_metadata.get("output_tokens")
                or usage_metadata.get("completion_tokens")
                or 0
            )
        else:
            prompt_tokens = int(getattr(usage_metadata, "input_tokens", 0) or 0)
            completion_tokens = int(getattr(usage_metadata, "output_tokens", 0) or 0)

    response_metadata = getattr(message, "response_metadata", None) or {}
    if isinstance(response_metadata, dict):
        usage = response_metadata.get("token_usage") or {}
        if not prompt_tokens:
            prompt_tokens = int(usage.get("prompt_tokens", 0) or 0)
        if not completion_tokens:
            completion_tokens = int(usage.get("completion_tokens", 0) or 0)
        model = str(response_metadata.get("model_name") or response_metadata.get("model") or "")

    return prompt_tokens, completion_tokens, model


def record_llm_from_ai_message(step: str, message: Any, duration_ms: int) -> None:
    """Record LLM usage from the response message (fallback when callbacks miss usage)."""
    metrics = get_run_metrics()
    if metrics is None:
        return

    prompt_tokens, completion_tokens, model = _parse_usage_from_message(message)
    if prompt_tokens or completion_tokens:
        metrics.record_llm(step, duration_ms, prompt_tokens, completion_tokens, model)
        return

    # Keep timing even when provider omits token counts.
    if not any(c.step == step and c.duration_ms == duration_ms for c in metrics.llm_calls):
        metrics.record_llm(step, duration_ms, 0, 0, model)
