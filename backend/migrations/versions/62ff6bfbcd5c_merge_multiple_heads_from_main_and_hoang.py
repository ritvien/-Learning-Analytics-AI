"""merge multiple heads from main and hoang

Revision ID: 62ff6bfbcd5c
Revises: d9e1f2a3b456, e102aae0a074
Create Date: 2026-06-18 14:29:56.806612
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '62ff6bfbcd5c'
down_revision: Union[str, None] = ('d9e1f2a3b456', 'e102aae0a074')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
