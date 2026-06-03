"""Add open_items + feedback (edited, rating) to replies.

Supports the review workspace: a drafted reply carries the sub-questions the KB
couldn't answer (open_items), and at closure we record whether it was edited and
an optional usefulness rating.

Revision ID: a1b2c3d4e5f6
Revises: 2e092cffdd45
Create Date: 2026-06-03
"""

from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "2e092cffdd45"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "replies",
        sa.Column("open_items", JSONB(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "replies",
        sa.Column("edited", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("replies", sa.Column("rating", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("replies", "rating")
    op.drop_column("replies", "edited")
    op.drop_column("replies", "open_items")
