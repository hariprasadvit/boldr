"""Vercel serverless entrypoint.

Vercel's @vercel/python runtime serves the ASGI callable named ``app`` exported
by this module. We re-export the FastAPI app from ``app.main`` so all
configuration lives in one place. Routing (all paths -> this module) is handled
by ``vercel.json``.

When built from the repo root (Git deploys), the ``backend`` directory must be
on ``sys.path`` for ``app`` to import; we add it explicitly so the entrypoint
works whether the build root is ``backend/`` or the repository root.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app

__all__ = ["app"]
