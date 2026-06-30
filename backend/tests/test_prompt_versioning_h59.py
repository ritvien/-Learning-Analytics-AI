"""Tests for H59 — LangSmith tracing + prompt versioning.

Covers:
  1. Prompt manifest: all prompts have valid version, checksum, name.
  2. Persistence idempotency: calling ensure twice does not duplicate rows.
  3. Chat tracing config: _build_langsmith_config produces correct metadata.
"""

from __future__ import annotations

import re
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.agent.prompts import (
    CORE_AGENT_SYSTEM_PROMPT,
    FAST_RESPONSE_SYSTEM_PROMPT,
    ROUTER_SYSTEM_PROMPT,
    get_universal_agent_prompt_manifest,
)

# ── 1. Prompt manifest tests ──────────────────────────────────────────

class TestPromptManifest:
    """Validate the universal agent prompt manifest."""

    def test_manifest_has_three_entries(self):
        manifest = get_universal_agent_prompt_manifest()
        assert len(manifest) == 3

    def test_manifest_prompt_names(self):
        manifest = get_universal_agent_prompt_manifest()
        names = {entry["name"] for entry in manifest}
        assert names == {"router", "core_agent", "fast_response"}

    def test_manifest_versions_not_empty(self):
        manifest = get_universal_agent_prompt_manifest()
        for entry in manifest:
            assert entry["version"], f"Version is empty for {entry['name']}"

    def test_manifest_checksums_are_64_hex(self):
        manifest = get_universal_agent_prompt_manifest()
        hex_pattern = re.compile(r"^[0-9a-f]{64}$")
        for entry in manifest:
            assert hex_pattern.match(entry["checksum"]), (
                f"Checksum for {entry['name']} is not 64-char hex: {entry['checksum']}"
            )

    def test_manifest_all_active(self):
        manifest = get_universal_agent_prompt_manifest()
        for entry in manifest:
            assert entry["is_active"] is True

    def test_manifest_no_raw_content(self):
        """Manifest should NOT include raw prompt text."""
        manifest = get_universal_agent_prompt_manifest()
        for entry in manifest:
            assert "content" not in entry, (
                f"Manifest entry for {entry['name']} leaks raw content"
            )

    def test_manifest_checksums_are_deterministic(self):
        """Same prompt text should produce same checksum across calls."""
        m1 = get_universal_agent_prompt_manifest()
        m2 = get_universal_agent_prompt_manifest()
        for e1, e2 in zip(m1, m2, strict=True):
            assert e1["checksum"] == e2["checksum"]

    def test_prompt_texts_not_empty(self):
        """Sanity: the actual prompt strings we're checksumming are non-empty."""
        assert len(ROUTER_SYSTEM_PROMPT) > 100
        assert len(CORE_AGENT_SYSTEM_PROMPT) > 100
        assert len(FAST_RESPONSE_SYSTEM_PROMPT) > 100


# ── 2. Persistence idempotency tests ──────────────────────────────────

class TestPromptPersistence:
    """Ensure prompt version persistence is idempotent."""

    @pytest.mark.asyncio
    async def test_ensure_prompt_versions_no_duplicate(self):
        """Calling ensure_universal_agent_prompt_versions twice should not
        create duplicate rows — the second call is a no-op."""
        from unittest.mock import MagicMock

        from app.agent.prompt_versioning import ensure_universal_agent_prompt_versions

        # Mock AsyncSession
        mock_db = AsyncMock()

        # First call: scalar_one_or_none returns None (not yet persisted)
        # Result.scalar_one_or_none() is SYNC, so use MagicMock
        mock_result_empty = MagicMock()
        mock_result_empty.scalar_one_or_none.return_value = None

        # Second call: scalar_one_or_none returns a truthy value (already exists)
        mock_result_exists = MagicMock()
        mock_result_exists.scalar_one_or_none.return_value = object()

        # First invocation — should add 3 entries
        mock_db.execute = AsyncMock(return_value=mock_result_empty)
        mock_db.add = MagicMock()
        await ensure_universal_agent_prompt_versions(mock_db)
        assert mock_db.add.call_count == 3

        # Reset mock
        mock_db.reset_mock()

        # Second invocation — should add 0 entries (all exist)
        mock_db.execute = AsyncMock(return_value=mock_result_exists)
        mock_db.add = MagicMock()
        await ensure_universal_agent_prompt_versions(mock_db)
        assert mock_db.add.call_count == 0


# ── 3. Chat tracing config tests ──────────────────────────────────────

class TestLangSmithConfig:
    """Validate _build_langsmith_config output shape."""

    def _build_config(self) -> dict[str, Any]:
        # Import here to avoid circular imports at module level
        from app.api.v1.endpoints.chat import _build_langsmith_config

        return _build_langsmith_config(
            run_name="eduinsight-chat",
            mode="standard",
            agent_run_id="test-run-id-123",
            conversation_id="conv-456",
            user_role="admin",
            obs_context={
                "trace_id": "trace-789",
                "request_id": "req-abc",
            },
        )

    def test_config_has_run_name(self):
        config = self._build_config()
        assert config["run_name"] == "eduinsight-chat"

    def test_config_has_tags(self):
        config = self._build_config()
        tags = config["tags"]
        assert "h59" in tags
        assert "eduinsight" in tags
        assert "standard" in tags

    def test_config_metadata_has_required_keys(self):
        config = self._build_config()
        metadata = config["metadata"]
        required_keys = {
            "trace_id", "request_id", "agent_run_id",
            "conversation_id", "user_role", "route", "prompt_versions",
        }
        assert required_keys.issubset(metadata.keys())

    def test_config_metadata_values(self):
        config = self._build_config()
        metadata = config["metadata"]
        assert metadata["agent_run_id"] == "test-run-id-123"
        assert metadata["conversation_id"] == "conv-456"
        assert metadata["user_role"] == "admin"
        assert metadata["route"] == "/api/v1/chat"

    def test_config_metadata_prompt_versions_format(self):
        config = self._build_config()
        prompt_versions = config["metadata"]["prompt_versions"]
        assert isinstance(prompt_versions, dict)
        assert "router" in prompt_versions
        assert "core_agent" in prompt_versions
        assert "fast_response" in prompt_versions
        # Each value should be "version:checksum12"
        for name, value in prompt_versions.items():
            assert ":" in value, f"Prompt version for {name} missing colon separator"
            version_part, checksum_part = value.split(":", 1)
            assert len(checksum_part) == 12, (
                f"Checksum fragment for {name} should be 12 chars, got {len(checksum_part)}"
            )

    def test_config_metadata_no_raw_message(self):
        """Metadata should not contain raw user messages or prompt text."""
        config = self._build_config()
        metadata = config["metadata"]
        # Check no message-like content leaked
        assert "message" not in metadata
        assert "content" not in metadata
        assert "prompt" not in metadata  # no raw prompt text key

    def test_stream_mode_route(self):
        from app.api.v1.endpoints.chat import _build_langsmith_config

        config = _build_langsmith_config(
            run_name="eduinsight-chat-stream",
            mode="stream",
            agent_run_id="run-1",
            conversation_id="conv-1",
            user_role="lecturer",
            obs_context={},
        )
        assert config["metadata"]["route"] == "/api/v1/chat/stream"
        assert "stream" in config["tags"]
