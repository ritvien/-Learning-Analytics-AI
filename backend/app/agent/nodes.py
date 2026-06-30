"""LangGraph nodes for the EduInsight Agent."""

import logging
import os
import time

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.agent.errors import (
    CORE_AGENT_FALLBACK_MESSAGE,
    ROUTER_FALLBACK_MESSAGE,
    MissingLLMCredentialsError,
)
from app.agent.guardrails import apply_output_guardrails, build_role_guardrail_block
from app.agent.instrumentation import wrap_tools_with_timing
from app.agent.prompts import (
    CORE_AGENT_SYSTEM_PROMPT,
    FAST_RESPONSE_SYSTEM_PROMPT,
    ROUTER_SYSTEM_PROMPT,
)
from app.agent.route_decision import (
    ComplexityLevel,
    IntentCategory,
    RouterClassification,
    build_route_decision,
    parse_router_response,
)
from app.agent.state import AgentState
from app.agent.tools import (
    calculate_student_clo_scores,
    execute_sql_query,
    get_student_dropout_risk,
    lookup_student_by_code,
    set_agent_tool_context,
)
from app.config import get_settings
from app.eval.token_accumulator import record_llm_from_ai_message

logger = logging.getLogger(__name__)
settings = get_settings()

# Re-export for callers that import from nodes (e.g. chat endpoint).
__all__ = ["TOOLS", "MissingLLMCredentialsError", "route_after_router"]


_BASE_TOOLS = [
    execute_sql_query,
    calculate_student_clo_scores,
    lookup_student_by_code,
    get_student_dropout_risk,
]
TOOLS = wrap_tools_with_timing(_BASE_TOOLS)


def _build_openai_model(model_name: str, temperature: float) -> ChatOpenAI:
    """Build an OpenAI-compatible model with explicit credential checks."""
    if not model_name.strip():
        raise MissingLLMCredentialsError(
            "Missing LLM model. Set LLM_MODEL, AGENT_ROUTER_MODEL, AGENT_CORE_MODEL, or CHAT_TITLE_MODEL."
        )
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
    selected_model = model_name.strip() or settings.llm_model.strip()
    if not selected_model:
        raise MissingLLMCredentialsError(
            "Missing LLM model. Set LLM_MODEL, AGENT_ROUTER_MODEL, AGENT_CORE_MODEL, or CHAT_TITLE_MODEL."
        )
    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        kwargs = {"model": selected_model, "temperature": temperature}
        api_key = settings.llm_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if api_key:
            kwargs["google_api_key"] = api_key
        return ChatGoogleGenerativeAI(**kwargs)

    return _build_openai_model(selected_model, temperature)


def _router_fallback_context(page_context: dict) -> dict:
    """Safe router output when LLM classification fails."""
    classification = RouterClassification(
        graph_route="fast_response",
        intent_category=IntentCategory.help,
        complexity=ComplexityLevel.simple,
        needs_tools=False,
        reason=ROUTER_FALLBACK_MESSAGE,
    )
    route_decision = build_route_decision(classification, page_context)
    context = dict(page_context)
    context["intent"] = classification.graph_route
    context["intent_category"] = classification.intent_category.value
    context["complexity"] = classification.complexity.value
    context["needs_tools"] = classification.needs_tools
    context["route_decision"] = route_decision.model_dump()
    return context


def _core_system_prompt(page_context: dict) -> str:
    """Build core agent system prompt with server-side role guardrails."""
    return CORE_AGENT_SYSTEM_PROMPT + build_role_guardrail_block(page_context)


async def router_node(state: AgentState) -> dict:
    """Classify intent, complexity, and produce route_decision for the client."""
    messages = state.get("messages", [])
    if not messages:
        return {"error": "No messages found"}

    page_context = dict(state.get("context", {}))

    try:
        llm = get_model(settings.agent_router_model, temperature=0)

        last_user_msg = messages[-1].content if messages else ""
        context_hint = ""
        if page_context:
            context_hint = f"\n\nPage context (JSON): {page_context}"
        eval_messages = [
            SystemMessage(content=ROUTER_SYSTEM_PROMPT),
            HumanMessage(content=f"{last_user_msg}{context_hint}"),
        ]

        router_start = time.perf_counter()
        response = await llm.ainvoke(eval_messages)
        record_llm_from_ai_message(
            "router",
            response,
            int((time.perf_counter() - router_start) * 1000),
        )
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
    except MissingLLMCredentialsError:
        raise
    except Exception as exc:
        logger.exception("router_node failed, falling back to fast_response")
        return {
            "context": _router_fallback_context(page_context),
            "error": f"{type(exc).__name__}: {ROUTER_FALLBACK_MESSAGE}",
        }


async def core_agent_node(state: AgentState) -> dict:
    """Core Agent that reasons and may call tools."""

    try:
        llm = get_model(settings.agent_core_model, temperature=0.2)
        llm_with_tools = llm.bind_tools(TOOLS)

        messages = list(state.get("messages", []))
        page_context = state.get("context", {})
        set_agent_tool_context(page_context)
        has_system = any(isinstance(message, SystemMessage) for message in messages)
        if not has_system:
            context_note = ""
            if page_context:
                context_note = f"\n\nPage context:\n{page_context}"
            messages = [SystemMessage(content=_core_system_prompt(page_context) + context_note), *messages]

        core_start = time.perf_counter()
        response = await llm_with_tools.ainvoke(messages)
        record_llm_from_ai_message(
            "core_agent",
            response,
            int((time.perf_counter() - core_start) * 1000),
        )
        if isinstance(response.content, str) and response.content:
            response.content = apply_output_guardrails(response.content)

        return {"messages": [response]}
    except MissingLLMCredentialsError:
        raise
    except Exception as exc:
        logger.exception("core_agent_node LLM call failed")
        fallback = AIMessage(content=CORE_AGENT_FALLBACK_MESSAGE)
        return {
            "messages": [fallback],
            "error": f"{type(exc).__name__}: {CORE_AGENT_FALLBACK_MESSAGE}",
        }


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
        role_block = build_role_guardrail_block(page_context) if page_context else ""

        eval_messages = [
            SystemMessage(content=FAST_RESPONSE_SYSTEM_PROMPT + role_block),
            HumanMessage(content=f"{last_user_msg}{context_block}"),
        ]

        fast_start = time.perf_counter()
        response = await llm.ainvoke(eval_messages)
        record_llm_from_ai_message(
            "fast_response",
            response,
            int((time.perf_counter() - fast_start) * 1000),
        )
        if isinstance(response.content, str) and response.content:
            response.content = apply_output_guardrails(response.content)
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
