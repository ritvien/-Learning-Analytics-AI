"""Agent error handling utilities — H52 three-tier + HTTP mapping.

Tier 1 (tool): tools return ``ERROR: ...`` strings; ``tool_error_handler`` for ToolNode.
Tier 2 (node): nodes catch LLM failures and return partial state with ``error``.
Tier 3 (graph): ``RetryPolicy`` + ``ToolNode(handle_tool_errors=...)`` in ``graph.py``.
HTTP: ``map_agent_exception_to_http`` maps exceptions to status + user-safe detail.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import status

logger = logging.getLogger(__name__)

# ── User-facing fallbacks (Vietnamese, no internal details) ─────────────

ROUTER_FALLBACK_MESSAGE = (
    "Hiện không phân loại được yêu cầu. Tôi sẽ trả lời nhanh dựa trên ngữ cảnh trang."
)
CORE_AGENT_FALLBACK_MESSAGE = (
    "Xin lỗi, tôi gặp sự cố khi xử lý câu hỏi. "
    "Vui lòng thử lại hoặc đơn giản hóa câu hỏi."
)
GENERIC_HTTP_MESSAGE = "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại."
RATE_LIMIT_MESSAGE = "Agent đang quá tải. Vui lòng thử lại sau vài giây."
AUTH_ERROR_DEV_MESSAGE = "API key không hợp lệ. Kiểm tra lại .env file."
AUTH_ERROR_PROD_MESSAGE = "Lỗi cấu hình hệ thống. Vui lòng liên hệ admin."


class MissingLLMCredentialsError(RuntimeError):
    """Raised when the configured LLM provider has no usable credentials."""


def _exception_name(exc: BaseException) -> str:
    return type(exc).__name__


def is_rate_limit_error(exc: BaseException) -> bool:
    """Detect LLM/provider rate-limit errors across SDK wrappers."""
    if "RateLimit" in _exception_name(exc):
        return True
    status_code = getattr(exc, "status_code", None)
    if status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        return True
    response = getattr(exc, "response", None)
    if response is not None and getattr(response, "status_code", None) == status.HTTP_429_TOO_MANY_REQUESTS:
        return True
    return False


def is_auth_error(exc: BaseException) -> bool:
    """Detect invalid API key / authentication failures."""
    if isinstance(exc, MissingLLMCredentialsError):
        return True
    name = _exception_name(exc)
    if "Auth" in name or "Permission" in name or "Unauthorized" in name:
        return True
    status_code = getattr(exc, "status_code", None)
    return status_code in {401, 403}


def is_transient_error(exc: BaseException) -> bool:
    """Errors that may succeed on retry (timeout, connection)."""
    if isinstance(exc, TimeoutError | ConnectionError):
        return True
    name = _exception_name(exc)
    return "Timeout" in name or "Connection" in name


def tool_error_handler(error: Exception, tool_call: dict[str, Any]) -> str:
    """Tier 3 — custom ToolNode handler; never re-raise to the graph."""
    tool_name = tool_call.get("name", "unknown")
    logger.warning(
        "Tool %s failed: %s",
        tool_name,
        error,
        exc_info=not is_transient_error(error),
    )
    if isinstance(error, TimeoutError):
        return (
            f"Tool '{tool_name}' timeout. "
            "Hãy thử lại hoặc dùng cách tiếp cận khác."
        )
    if isinstance(error, ConnectionError):
        return (
            f"Tool '{tool_name}' không kết nối được. "
            "Hãy thử tool khác hoặc trả lời dựa trên kiến thức có sẵn."
        )
    return (
        f"Tool '{tool_name}' lỗi: {type(error).__name__}. "
        "Hãy thử cách tiếp cận khác."
    )


def map_agent_exception_to_http(
    exc: BaseException,
    *,
    is_development: bool,
) -> tuple[int, str]:
    """Map agent-layer exceptions to HTTP status and user-safe detail."""
    if isinstance(exc, MissingLLMCredentialsError):
        detail = str(exc) if is_development else AUTH_ERROR_PROD_MESSAGE
        return status.HTTP_503_SERVICE_UNAVAILABLE, detail

    if is_rate_limit_error(exc):
        return status.HTTP_429_TOO_MANY_REQUESTS, RATE_LIMIT_MESSAGE

    if is_auth_error(exc):
        detail = AUTH_ERROR_DEV_MESSAGE if is_development else AUTH_ERROR_PROD_MESSAGE
        return status.HTTP_500_INTERNAL_SERVER_ERROR, detail

    if is_development:
        return status.HTTP_500_INTERNAL_SERVER_ERROR, f"Agent error: {exc}"

    return status.HTTP_500_INTERNAL_SERVER_ERROR, GENERIC_HTTP_MESSAGE


def stream_error_message(exc: BaseException, *, is_development: bool) -> str:
    """User-safe message for SSE ``type: error`` events."""
    _, detail = map_agent_exception_to_http(exc, is_development=is_development)
    return detail
