"""Run all seeders in order: personas -> KB -> tickets. (KB needs OPENROUTER_API_KEY.)"""

from __future__ import annotations

import asyncio

from app.scripts import seed_kb, seed_personas, seed_tickets


async def main() -> None:
    await seed_personas.main()
    await seed_tickets.main()
    await seed_kb.main()


if __name__ == "__main__":
    asyncio.run(main())
