"""Persist universal agent prompt versions to the database.

Follows the idempotent pattern established by
``report_service.ensure_report_agent_prompt`` (see ADR-010).
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.prompts import _prompt_entries_for_persistence
from app.models.agent import AgentPromptVersion

logger = logging.getLogger(__name__)


async def ensure_universal_agent_prompt_versions(db: AsyncSession) -> None:
    """Persist all universal agent prompt versions if they are missing.

    For each prompt entry (router, core_agent, fast_response), check if
    the (name, version) pair already exists.  If not, insert a new row.
    This is safe to call on every request — the SELECT guard prevents
    duplicates without requiring a unique constraint migration.
    """
    entries = _prompt_entries_for_persistence()
    for entry in entries:
        result = await db.execute(
            select(AgentPromptVersion).where(
                AgentPromptVersion.name == entry["name"],
                AgentPromptVersion.version == entry["version"],
            )
        )
        if result.scalar_one_or_none() is not None:
            continue
        db.add(
            AgentPromptVersion(
                name=entry["name"],
                version=entry["version"],
                content=entry["content"],
                checksum=entry["checksum"],
                is_active=entry["is_active"],
            )
        )
        logger.info(
            "Persisted prompt version %s@%s (checksum=%s)",
            entry["name"],
            entry["version"],
            entry["checksum"][:12],
        )
    await db.flush()
