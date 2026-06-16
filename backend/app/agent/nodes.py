"""LangGraph nodes for the EduInsight Agent."""

import logging
import re

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.agent.prompts import (
    CORE_AGENT_SYSTEM_PROMPT,
    FAST_RESPONSE_SYSTEM_PROMPT,
    ROUTER_SYSTEM_PROMPT,
)
from app.agent.state import AgentState
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_SCHEMA_PATTERNS = re.compile(
    r'(?:'
    r'`?(?:students|enrollments|sections|courses|programs|cohorts|'
    r'departments|universities|teachers|clos|plos|semesters|'
    r'student_clo_achievements|program_courses|vw_\w+)`?'
    r'(?:\.\w+)?'  # table.column
    r'|ILIKE|JOIN|WHERE|GROUP BY|SELECT|FROM|COUNT\(|SUM\(|AVG\('
    r'|status\s*=\s*[\'"]completed[\'"]'
    r')',
    re.IGNORECASE
)

def _sanitize_response(text: str) -> str:
    """Remove any leaked DB schema references from agent output."""
    if not text:
        return text
    return _SCHEMA_PATTERNS.sub('[dữ liệu hệ thống]', text)

def get_model(model_name: str, temperature: float = 0):
    """Factory helper to build ChatOpenAI or ChatGoogleGenerativeAI model."""
    provider = settings.llm_provider.lower().strip()
    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        # Map models if they are configured as openai format
        actual_model = settings.llm_model if "gemini" in settings.llm_model else "gemini-1.5-flash"
        kwargs = {"model": actual_model, "temperature": temperature}
        if settings.llm_api_key:
            kwargs["google_api_key"] = settings.llm_api_key
        return ChatGoogleGenerativeAI(**kwargs)
    else:
        return ChatOpenAI(
            model=model_name,
            api_key=settings.llm_api_key or None,
            temperature=temperature,
        )


# ─────────────────────────────────────────────────────── Router Node (H12)
async def router_node(state: AgentState) -> dict:
    """Classify the intent of the latest user message.

    Sets ``context["intent"]`` to either ``"core_agent"`` or ``"fast_response"``.
    Does NOT add messages to the conversation history.
    """
    llm = get_model(settings.agent_router_model, temperature=0)

    messages = state.get("messages", [])
    if not messages:
        return {"error": "No messages found"}

    last_user_msg = messages[-1].content if messages else ""

    eval_messages = [
        SystemMessage(content=ROUTER_SYSTEM_PROMPT),
        HumanMessage(content=last_user_msg),
    ]

    response = await llm.ainvoke(eval_messages)
    intent = response.content.strip().lower()

    # Normalise to one of two expected values
    decision = "core_agent" if "core_agent" in intent else "fast_response"
    logger.info("Router decision: %s (raw: %s)", decision, intent)

    context = dict(state.get("context", {}))
    context["intent"] = decision

    return {"context": context}


# ────────────────────────────────────────────── Core Agent Node (H13)
async def core_agent_node(state: AgentState) -> dict:
    """Core Agent that reasons and may call tools (ReAct pattern).

    On the *first* invocation the system prompt is prepended.
    On subsequent loop iterations (after ToolNode) the system prompt
    is already present, so we skip it.
    """
    from app.agent.tools import sql_query_tool

    llm = ChatOpenAI(
        model=settings.agent_core_model,
        api_key=settings.llm_api_key or None,
        temperature=0.2,
    )

    llm_with_tools = llm.bind_tools([sql_query_tool])

    messages = list(state.get("messages", []))

    # Inject system prompt only on the first call (no SystemMessage yet)
    has_system = any(isinstance(m, SystemMessage) for m in messages)
    if not has_system:
        messages = [SystemMessage(content=CORE_AGENT_SYSTEM_PROMPT), *messages]

    response = await llm_with_tools.ainvoke(messages)

    # Sanitize the output if it's the final answer
    if hasattr(response, "tool_calls") and not response.tool_calls and isinstance(response.content, str):
        response.content = _sanitize_response(response.content)

    return {"messages": [response]}


# ──────────────────────────────────────────── Fast Response Node (H12)
async def fast_response_node(state: AgentState) -> dict:
    """Answer simple chit-chat queries using a lightweight LLM call.

    Uses the router model (cheap) with a friendly system prompt.
    Falls back to a static greeting if the API call fails.
    """
    try:
        llm = ChatOpenAI(
            model=settings.agent_router_model,
            api_key=settings.llm_api_key or None,
            temperature=0.7,
        )

        messages = state.get("messages", [])
        last_user_msg = messages[-1].content if messages else ""

        eval_messages = [
            SystemMessage(content=FAST_RESPONSE_SYSTEM_PROMPT),
            HumanMessage(content=last_user_msg),
        ]

        response = await llm.ainvoke(eval_messages)
        return {"messages": [response]}

    except Exception:
        logger.exception("fast_response_node LLM call failed, using static fallback")
        fallback = AIMessage(content=FAST_RESPONSE_SYSTEM_PROMPT)
        return {"messages": [fallback]}


# ────────────────────────────────────────────── Routing helper
def route_after_router(state: AgentState) -> str:
    """Conditional edge function: read intent set by ``router_node``."""
    context = state.get("context", {})
    intent = context.get("intent", "fast_response")
    return intent
