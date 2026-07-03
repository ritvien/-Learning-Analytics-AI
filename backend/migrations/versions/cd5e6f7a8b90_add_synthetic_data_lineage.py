"""Add reversible synthetic data lineage registry.

Revision ID: cd5e6f7a8b90
Revises: bc4d5e6f7a81
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "cd5e6f7a8b90"
down_revision: str | None = "bc4d5e6f7a81"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "synthetic_data_lineage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source", sa.String(80), nullable=False),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("seed", sa.Integer(), nullable=False),
        sa.Column("official", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("derivation", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("source", "entity_type", "entity_id", name="uq_synthetic_lineage_entity"),
    )
    op.create_index("ix_synthetic_data_lineage_source", "synthetic_data_lineage", ["source"])


def downgrade() -> None:
    op.drop_index("ix_synthetic_data_lineage_source", table_name="synthetic_data_lineage")
    op.drop_table("synthetic_data_lineage")
