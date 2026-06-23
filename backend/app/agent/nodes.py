"""LangGraph nodes for the EduInsight Agent."""

import logging
import os
import re

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.agent.prompts import (
    CORE_AGENT_SYSTEM_PROMPT,
    FAST_RESPONSE_SYSTEM_PROMPT,
    ROUTER_SYSTEM_PROMPT,
)
from app.agent.route_decision import build_route_decision, parse_router_response
from app.agent.state import AgentState
from app.agent.tools import calculate_student_clo_scores, execute_sql_query
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class MissingLLMCredentialsError(RuntimeError):
    """Raised when the configured LLM provider has no usable credentials."""


TOOLS = [execute_sql_query, calculate_student_clo_scores]

_SCHEMA_PATTERNS = re.compile(
    r"(?:"
    r"`?(?:students|enrollments|sections|courses|programs|cohorts|"
    r"departments|universities|teachers|clos|plos|semesters|"
    r"student_clo_achievements|program_courses|specializations|"
    r"specialization_courses|vw_\w+)`?"
    r"(?:\.\w+)?"
    r"|ILIKE|JOIN|WHERE|GROUP BY|SELECT|FROM|COUNT\(|SUM\(|AVG\("
    r"|status\s*=\s*['\"]completed['\"]"
    r")",
    re.IGNORECASE,
)


def _sanitize_response(text: str) -> str:
    """Remove any leaked DB schema references from agent output."""
    if not text:
        return text
    return _SCHEMA_PATTERNS.sub("[du lieu he thong]", text)


def _build_openai_model(model_name: str, temperature: float) -> ChatOpenAI:
    """Build an OpenAI-compatible model with explicit credential checks."""
    api_key = (
        settings.llm_api_key
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("OPENAI_ADMIN_KEY")
    )
    if not api_key:
        raise MissingLLMCredentialsError(
            "Missing OpenAI credentials. Set OPENAI_API_KEY or LLM_API_KEY for the backend service."
        )

    kwargs = {
        "model": model_name,
        "api_key": api_key,
        "temperature": temperature,
    }
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
    return ChatOpenAI(**kwargs)


def get_model(model_name: str, temperature: float = 0) -> BaseChatModel:
    """Build a ChatOpenAI or ChatGoogleGenerativeAI model."""
    provider = settings.llm_provider.lower().strip()
    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        actual_model = settings.llm_model if "gemini" in settings.llm_model else "gemini-1.5-flash"
        kwargs = {"model": actual_model, "temperature": temperature}
        api_key = settings.llm_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if api_key:
            kwargs["google_api_key"] = api_key
        return ChatGoogleGenerativeAI(**kwargs)

    return _build_openai_model(model_name, temperature)


async def router_node(state: AgentState) -> dict:
    """Classify intent, complexity, and produce route_decision for the client."""
    llm = get_model(settings.agent_router_model, temperature=0)

    messages = state.get("messages", [])
    if not messages:
        return {"error": "No messages found"}

    page_context = dict(state.get("context", {}))
    last_user_msg = messages[-1].content if messages else ""
    context_hint = ""
    if page_context:
        context_hint = f"\n\nPage context (JSON): {page_context}"
    eval_messages = [
        SystemMessage(content=ROUTER_SYSTEM_PROMPT),
        HumanMessage(content=f"{last_user_msg}{context_hint}"),
    ]

    response = await llm.ainvoke(eval_messages)
    classification = parse_router_response(str(response.content))
    route_decision = build_route_decision(classification, page_context)

    logger.info(
        "Router: graph=%s intent=%s complexity=%s mode=%s",
        classification.graph_route,
        classification.intent_category.value,
        classification.complexity.value,
        route_decision.mode.value,
    )

    context = dict(page_context)
    context["intent"] = classification.graph_route
    context["intent_category"] = classification.intent_category.value
    context["complexity"] = classification.complexity.value
    context["needs_tools"] = classification.needs_tools
    context["route_decision"] = route_decision.model_dump()

    return {"context": context}


async def core_agent_node(state: AgentState) -> dict:
    """Core Agent that reasons and may call tools."""
    from app.agent.tools import sql_query_tool

    llm = get_model(settings.agent_core_model, temperature=0.2)
    llm_with_tools = llm.bind_tools([sql_query_tool])

    messages = list(state.get("messages", []))
    has_system = any(isinstance(message, SystemMessage) for message in messages)
    if not has_system:
        context_note = ""
        page_context = state.get("context", {})
        if page_context:
            context_note = f"\n\nPage context:\n{page_context}"
        messages = [SystemMessage(content=CORE_AGENT_SYSTEM_PROMPT + context_note), *messages]

    response = await llm_with_tools.ainvoke(messages)
    if hasattr(response, "tool_calls") and not response.tool_calls and isinstance(response.content, str):
        response.content = _sanitize_response(response.content)

    return {"messages": [response]}


async def fast_response_node(state: AgentState) -> dict:
    """Answer simple queries using page context when available."""
    try:
        llm = get_model(settings.agent_router_model, temperature=0.7)

        messages = state.get("messages", [])
        last_user_msg = messages[-1].content if messages else ""
        page_context = state.get("context", {})
        context_block = ""
        if page_context:
            context_block = f"\n\nNgữ cảnh trang hiện tại:\n{page_context}"

        eval_messages = [
            SystemMessage(content=FAST_RESPONSE_SYSTEM_PROMPT),
            HumanMessage(content=f"{last_user_msg}{context_block}"),
        ]

        response = await llm.ainvoke(eval_messages)
        return {"messages": [response]}
    except Exception:
        logger.exception("fast_response_node LLM call failed, using static fallback")
        fallback = AIMessage(content="Xin chào! Tôi là EduInsight AI. Bạn có thể hỏi tôi về thống kê học vụ.")
        return {"messages": [fallback]}


def route_after_router(state: AgentState) -> str:
    """Conditional edge function: read intent set by ``router_node``."""
    context = state.get("context", {})
    intent = context.get("intent", "fast_response")
    return intent
