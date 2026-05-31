"""ORM models package.

Importing every model here ensures Alembic autogenerate and `Base.metadata` see
all tables.
"""

from app.db.base import Base  # noqa: F401
from app.models.approval import Approval  # noqa: F401
from app.models.gap import Gap  # noqa: F401
from app.models.kb_chunk import KbChunk  # noqa: F401
from app.models.persona import Persona  # noqa: F401
from app.models.reply import Reply  # noqa: F401
from app.models.run import Run  # noqa: F401
from app.models.ticket import Ticket  # noqa: F401

__all__ = ["Base", "Approval", "Gap", "KbChunk", "Persona", "Reply", "Run", "Ticket"]
