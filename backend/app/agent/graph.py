"""LangGraph StateGraph assembly for the EduInsight Agent.

Graph topology:
    START → router
    router →(conditional)→ core_agent | fast_response
    core_agent →(conditional: has tool_calls?)→ tools | END
    tools → core_agent   (ReAct loop)
    fast_response → END

Error handling (3-tier as per LangGraphAgent.md §4.9):
    Tier 1 — Tool level:  sql_query_tool returns "ERROR: ..." strings
    Tier 2 — Node level:  RetryPolicy on core_agent_node for transient failures
    Tier 3 — Graph level: ToolNode(handle_tool_errors=True)
"""

import logging

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import ToolNode
from langgraph.types import RetryPolicy

from app.agent.nodes import (
    core_agent_node,
    fast_response_node,
    route_after_router,
    router_node,
)
from app.agent.state import AgentState
from app.agent.tools import sql_query_tool

logger = logging.getLogger(__name__)


# ── Conditional edge: decide if core_agent needs to call tools ──────────
def should_continue(state: AgentState) -> str:
    """Check if the last AI message contains tool_calls.

    Returns:
        "tools"  — if the LLM wants to call a tool (ReAct continues).
        END      — if the LLM produced a final answer (ReAct terminates).

    """
    messages = state.get("messages", [])
    if not messages:
        return END

    last_message = messages[-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END


# ── Graph builder ───────────────────────────────────────────────────────
def create_agent() -> CompiledStateGraph:
    """Build and compile the EduInsight LangGraph agent.

    Returns:
        A compiled LangGraph ``CompiledGraph`` ready for ``.invoke()``
        or ``.ainvoke()`` calls.

    """
    graph = StateGraph(AgentState)

    # ── Tier 3: ToolNode with automatic error handling ──────────────
    tool_node = ToolNode(
        tools=[sql_query_tool],
        handle_tool_errors=True,
    )

    # ── Register nodes ─────────────────────────────────────────────
    graph.add_node("router", router_node)

    # Tier 2: RetryPolicy for transient network failures on LLM calls
    # Per LangGraphAgent.md §4.9: only retry on transient errors, fail fast on others
    graph.add_node(
        "core_agent",
        core_agent_node,
        retry_policy=RetryPolicy(
            max_attempts=3,
            retry_on=(TimeoutError, ConnectionError),
        ),
    )

    graph.add_node("fast_response", fast_response_node)
    graph.add_node("tools", tool_node)

    # ── Edges ──────────────────────────────────────────────────────
    # Entry point
    graph.add_edge(START, "router")

    # Router → conditional dispatch
    graph.add_conditional_edges(
        "router",
        route_after_router,
        {"core_agent": "core_agent", "fast_response": "fast_response"},
    )

    # Core agent → conditional: call tools or finish
    graph.add_conditional_edges(
        "core_agent",
        should_continue,
        {"tools": "tools", END: END},
    )

    # ReAct loop: tools result → back to core_agent for evaluation
    graph.add_edge("tools", "core_agent")

    # Fast response → end
    graph.add_edge("fast_response", END)

    # ── Compile ────────────────────────────────────────────────────
    compiled = graph.compile()
    logger.info("EduInsight agent graph compiled successfully.")
    return compiled
