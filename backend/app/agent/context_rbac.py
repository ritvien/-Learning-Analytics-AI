"""Server-side page context validation for universal chatbot (H48).

Client-sent context is untrusted; merge with authenticated user facts and RBAC.
"""

from typing import Any

from fastapi import HTTPException, status

from app.models.people import User, UserRole

_TRUSTED_KEYS = frozenset({"user_role", "department_scope", "department_id"})

_ROLE_MODULE_ACCESS: dict[UserRole, frozenset[str]] = {
    UserRole.superadmin: frozenset(
        {"dashboard", "report", "tree", "chat", "admin", "settings", "manager", "analytics", "reports", "students", "courses"}
    ),
    UserRole.admin: frozenset(
        {"dashboard", "report", "tree", "chat", "admin", "settings", "manager", "analytics", "reports", "students", "courses"}
    ),
    UserRole.manager: frozenset(
        {"dashboard", "report", "tree", "chat", "settings", "manager", "analytics", "reports", "students", "courses"}
    ),
    UserRole.lecturer: frozenset(
        {"dashboard", "report", "tree", "chat", "manager", "analytics", "reports", "students", "courses"}
    ),
    UserRole.viewer: frozenset({"dashboard", "report", "tree", "chat"}),
}


def validate_and_merge_context(user: User, client_context: dict[str, Any] | None) -> dict[str, Any]:
    """Return merged context with server-authoritative RBAC fields."""
    incoming = dict(client_context or {})
    merged: dict[str, Any] = {key: value for key, value in incoming.items() if key not in _TRUSTED_KEYS}

    merged["user_role"] = user.role.value
    merged["department_scope"] = user.department_id
    if user.department_id is not None:
        merged["department_id"] = user.department_id

    module = str(merged.get("module") or merged.get("route") or "").strip().lower()
    if module:
        allowed = _ROLE_MODULE_ACCESS.get(user.role, frozenset())
        module_key = module.lstrip("/").split("/")[0] or module
        if module_key not in allowed and module_key not in {"chatbot", "chat"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {user.role.value} cannot access module {module_key}",
            )

    if user.role == UserRole.lecturer and merged.get("entity_type") == "student":
        # Lecturers must not query arbitrary students via client-forged entity_id without scope check.
        # Full entity resolution is H49; here we reject obviously cross-department scope claims.
        claimed_dept = incoming.get("department_id") or incoming.get("department_scope")
        if claimed_dept is not None and claimed_dept != user.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Department scope mismatch for lecturer role",
            )

    return merged
