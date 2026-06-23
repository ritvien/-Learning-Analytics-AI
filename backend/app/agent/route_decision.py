"""Route decision contract for universal chatbot (H48).

Frontend (V40) uses ``RouteDecision`` to choose inline answer vs full-page chat.
"""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class RouteMode(StrEnum):
    """How the client should present the agent response."""

    inline = "inline"
    full_chat = "full_chat"


class IntentCategory(StrEnum):
    """High-level intent beyond Report Center scope."""

    chitchat = "chitchat"
    analytics = "analytics"
    report = "report"
    navigation = "navigation"
    help = "help"


class ComplexityLevel(StrEnum):
    """Whether page context alone is enough."""

    simple = "simple"
    complex = "complex"


class RouteDecision(BaseModel):
    """Minimum schema for V40 route handoff."""

    mode: RouteMode
    target_route: str = Field(description="Next.js route, e.g. /chatbot or current page path")
    reason: str
    preserve_context: bool = True


class RouterClassification(BaseModel):
    """Parsed output from the router node."""

    graph_route: str = Field(description="core_agent or fast_response")
    intent_category: IntentCategory = IntentCategory.analytics
    complexity: ComplexityLevel = ComplexityLevel.complex
    needs_tools: bool = False
    reason: str = ""


def build_route_decision(
    classification: RouterClassification,
    page_context: dict[str, Any],
) -> RouteDecision:
    """Derive client route decision from router classification and page context."""
    current_route = str(page_context.get("route") or page_context.get("module") or "/")

    if classification.graph_route == "fast_response" and classification.complexity == ComplexityLevel.simple:
        return RouteDecision(
            mode=RouteMode.inline,
            target_route=current_route,
            reason=classification.reason or "Simple conversational query answered inline",
            preserve_context=True,
        )

    if (
        classification.complexity == ComplexityLevel.simple
        and not classification.needs_tools
        and page_context.get("entity_type")
    ):
        return RouteDecision(
            mode=RouteMode.inline,
            target_route=current_route,
            reason=classification.reason or "Answer using current page context without tool orchestration",
            preserve_context=True,
        )

    return RouteDecision(
        mode=RouteMode.full_chat,
        target_route="/chatbot",
        reason=classification.reason or "Multi-step or tool-backed query requires full chatbot",
        preserve_context=True,
    )


def parse_router_response(raw: str) -> RouterClassification:
    """Parse router LLM output (JSON or legacy single-token)."""
    import json

    text = (raw or "").strip()
    if text.startswith("{"):
        try:
            data = json.loads(text)
            graph_route = str(data.get("graph_route", "core_agent")).strip().lower()
            if graph_route not in {"core_agent", "fast_response"}:
                graph_route = "core_agent"
            intent_raw = str(data.get("intent_category", "analytics")).strip().lower()
            try:
                intent_category = IntentCategory(intent_raw)
            except ValueError:
                intent_category = IntentCategory.analytics
            complexity_raw = str(data.get("complexity", "complex")).strip().lower()
            try:
                complexity = ComplexityLevel(complexity_raw)
            except ValueError:
                complexity = ComplexityLevel.complex
            return RouterClassification(
                graph_route=graph_route,
                intent_category=intent_category,
                complexity=complexity,
                needs_tools=bool(data.get("needs_tools", graph_route == "core_agent")),
                reason=str(data.get("reason", "")),
            )
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    lowered = text.lower()
    if "fast_response" in lowered:
        return RouterClassification(
            graph_route="fast_response",
            intent_category=IntentCategory.chitchat,
            complexity=ComplexityLevel.simple,
            needs_tools=False,
            reason="Legacy router token: fast_response",
        )
    return RouterClassification(
        graph_route="core_agent",
        intent_category=IntentCategory.analytics,
        complexity=ComplexityLevel.complex,
        needs_tools=True,
        reason="Legacy router token: core_agent",
    )
