"""Vercel serverless entrypoint.

Vercel's @vercel/python runtime serves the ASGI callable named ``app`` exported
by this module. We re-export the FastAPI app from ``app.main`` so all
configuration lives in one place. Routing (all paths -> this module) is handled
by ``vercel.json``.
"""

from app.main import app

__all__ = ["app"]
